package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationAfterCommitService;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.member.dto.AppliedPositionChangeScheduleEffect;
import ru.staffly.member.dto.PositionChangeScheduleEffectType;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
import ru.staffly.training.dto.CertificationAudienceEffectType;
import ru.staffly.user.model.User;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Translates immutable mutation results into recipient/kind groups. */
@Service
@RequiredArgsConstructor
@Slf4j
public class PositionChangeNotificationService {
    private final RestaurantMemberRepository members;
    private final BusinessNotificationAfterCommitService afterCommit;

    public void submit(RestaurantMember subject, User actor, UUID operationId,
                       String oldPositionName, String newPositionName,
                       List<AppliedPositionChangeScheduleEffect> scheduleEffects,
                       List<AppliedCertificationAudienceEffect> certificationEffects,
                       List<ru.staffly.schedule.dto.AppliedScheduleOwnershipTransfer> scheduleTransfers,
                       List<ru.staffly.training.dto.AppliedCertificationOwnershipTransfer> certificationTransfers,
                       List<ru.staffly.task.lifecycle.TaskTerminationResult.Transfer> taskTransfers) {
        List<BusinessNotificationCommand> commands = new ArrayList<>();
        commands.add(command(subject, actor, operationId, subject, BusinessNotificationKind.POSITION_CHANGE,
                "Ваша должность в ресторане изменена с «" + oldPositionName + "» на «" + newPositionName + "».",
                "Ваша должность изменена. Теперь ваша должность — «" + newPositionName + "».", Map.of()));

        var preference = scheduleEffects.stream().filter(this::requiresPreferenceAction)
                .sorted(Comparator.comparing(AppliedPositionChangeScheduleEffect::scheduleId)).toList();
        if (!preference.isEmpty()) {
            commands.add(command(subject, actor, operationId, subject,
                    BusinessNotificationKind.POSITION_CHANGE_PREFERENCES,
                    "После смены должности отправьте пожелания заново для графиков:\n" + scheduleLines(preference, true),
                    "После смены должности обновите пожелания по графикам.", metadata(subject, preference.stream()
                            .map(AppliedPositionChangeScheduleEffect::scheduleId).toList())));
        }
        var cancelled = scheduleEffects.stream()
                .filter(e -> e.consequences().contains(PositionChangeScheduleEffectType.PUBLISHED_FUTURE_SHIFTS_CANCELLED))
                .sorted(Comparator.comparing(AppliedPositionChangeScheduleEffect::scheduleId)).toList();
        if (!cancelled.isEmpty()) {
            commands.add(command(subject, actor, operationId, subject, BusinessNotificationKind.POSITION_CHANGE_SHIFTS,
                    "Из-за смены должности будущие смены отменены в графиках:\n" + scheduleLines(cancelled, false),
                    "После смены должности ваши будущие смены были изменены.",
                    metadata(subject, cancelled.stream().map(AppliedPositionChangeScheduleEffect::scheduleId).toList())));
        }

        var newAssignments = certificationEffects.stream().filter(e -> e.effectType() == CertificationAudienceEffectType.CREATED
                || e.effectType() == CertificationAudienceEffectType.REACTIVATED).toList();
        if (!newAssignments.isEmpty()) commands.add(command(subject, actor, operationId, subject, BusinessNotificationKind.CERTIFICATION,
                "После смены должности вам назначены аттестации: " + newAssignments.stream().map(e -> e.certificationTitle()).collect(Collectors.joining(", ")),
                "После смены должности вам назначены аттестации.", metadata(subject, newAssignments.stream().map(e -> e.certificationId()).toList())));
        var notifiableCertifications = certificationEffects.stream()
                .filter(e -> e.effectType() != CertificationAudienceEffectType.UNCHANGED)
                .filter(e -> e.ownerUserId() != null).toList();
        Set<Long> ownerIds = new HashSet<>();
        scheduleEffects.stream().map(AppliedPositionChangeScheduleEffect::ownerUserId).filter(Objects::nonNull)
                .forEach(ownerIds::add);
        notifiableCertifications.stream().map(AppliedCertificationAudienceEffect::ownerUserId).forEach(ownerIds::add);
        Map<Long, RestaurantMember> recipients = ownerIds.isEmpty() ? Map.of() : members
                .findActiveByRestaurantIdAndUserIdIn(subject.getRestaurant().getId(), ownerIds).stream()
                .collect(Collectors.toMap(m -> m.getUser().getId(), Function.identity(), (a, b) -> a));
        ownerIds.stream().filter(id -> !recipients.containsKey(id)).forEach(id -> log.warn(
                "Skipping position-change owner notification: owner is not a current member (restaurantId={}, ownerUserId={})",
                subject.getRestaurant().getId(), id));

        scheduleEffects.stream().filter(e -> e.ownerUserId() != null)
                .collect(Collectors.groupingBy(AppliedPositionChangeScheduleEffect::ownerUserId)).forEach((id, effects) -> {
                    RestaurantMember recipient = recipients.get(id);
                    if (recipient == null) return;
                    var sorted = effects.stream().sorted(Comparator.comparing(AppliedPositionChangeScheduleEffect::scheduleId)).toList();
                    commands.add(command(subject, actor, operationId, recipient, BusinessNotificationKind.SCHEDULE,
                            subject.getUser().getFullName() + " сменил(а) должность. Изменения в графиках:\n"
                                    + ownerScheduleLines(sorted),
                            "Смена должности сотрудника повлияла на " + sorted.size() + " график(а).",
                            metadata(subject, sorted.stream().map(AppliedPositionChangeScheduleEffect::scheduleId).toList())));
                });
        notifiableCertifications.stream().collect(Collectors.groupingBy(AppliedCertificationAudienceEffect::ownerUserId))
                .forEach((id, effects) -> {
                    RestaurantMember recipient = recipients.get(id);
                    if (recipient == null) return;
                    var sorted = effects.stream().sorted(Comparator.comparing(AppliedCertificationAudienceEffect::certificationId)).toList();
                    String lines = sorted.stream().map(e -> "• " + e.certificationTitle() + " — " + certMeaning(e.effectType()))
                            .collect(Collectors.joining("\n"));
                    commands.add(command(subject, actor, operationId, recipient, BusinessNotificationKind.CERTIFICATION,
                            subject.getUser().getFullName() + " сменил(а) должность. Изменения в аттестациях:\n" + lines,
                            "Смена должности сотрудника повлияла на " + sorted.size() + " аттестацию(и).",
                            metadata(subject, sorted.stream().map(AppliedCertificationAudienceEffect::certificationId).toList())));
                });
        scheduleTransfers.stream().collect(Collectors.groupingBy(t -> t.newOwnerUserId())).forEach((id, values) ->
                addTransferCommand(commands, subject, actor, operationId, id, BusinessNotificationKind.SCHEDULE,
                        "Вам передали ответственность за графики: " + values.stream().map(t -> t.title()).collect(Collectors.joining(", "))));
        certificationTransfers.stream().filter(t -> t.active()).collect(Collectors.groupingBy(t -> t.newOwnerUserId())).forEach((id, values) ->
                addTransferCommand(commands, subject, actor, operationId, id, BusinessNotificationKind.CERTIFICATION,
                        "Вам передали ответственность за аттестации: " + values.stream().map(t -> t.title()).collect(Collectors.joining(", "))));
        taskTransfers.stream().collect(Collectors.groupingBy(t -> t.memberId())).forEach((id, values) -> {
            var recipient = members.findByIdAndEndedAtIsNull(id).orElse(null);
            if (recipient != null) commands.add(command(subject, actor, operationId, recipient, BusinessNotificationKind.TASK_RESPONSIBILITY,
                    "Вам передали ответственность за задачи: " + values.stream().map(t -> t.title()).collect(Collectors.joining(", ")),
                    "Вам передали ответственность за задачи.", metadata(subject, values.stream().map(t -> t.taskId()).toList())));
        });
        // Merge handoff and audience/row effects into one notification per user/module.
        Map<String, BusinessNotificationCommand> grouped = new LinkedHashMap<>();
        for (var c : commands) grouped.merge(c.recipient().getId() + ":" + c.kind(), c, (a, next) ->
                new BusinessNotificationCommand(a.restaurant(), a.operationId(), a.recipient(), a.actor(), a.kind(),
                        a.inboxText() + "\n" + next.inboxText(), a.pushText(), a.metadata(), null));
        afterCommit.submit(List.copyOf(grouped.values()));
    }

    private void addTransferCommand(List<BusinessNotificationCommand> commands, RestaurantMember subject, User actor,
                                    UUID operationId, Long userId, BusinessNotificationKind kind, String text) {
        var recipient = members.findActiveByUserIdAndRestaurantId(userId, subject.getRestaurant().getId()).orElse(null);
        if (recipient != null) commands.add(command(subject, actor, operationId, recipient, kind, text, text, Map.of()));
    }

    private boolean requiresPreferenceAction(AppliedPositionChangeScheduleEffect e) {
        return e.consequences().contains(PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED)
                && e.consequences().contains(PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);
    }
    private String scheduleLines(List<AppliedPositionChangeScheduleEffect> effects, boolean deadlines) {
        return effects.stream().map(e -> "• " + e.scheduleTitle()
                        + (deadlines && e.preferenceDeadline() != null ? " (срок: " + e.preferenceDeadline() + ")" : ""))
                .collect(Collectors.joining("\n"));
    }
    private String ownerScheduleLines(List<AppliedPositionChangeScheduleEffect> effects) {
        return effects.stream().map(e -> "• " + e.scheduleTitle() + ": " + e.consequences().stream()
                .sorted().map(this::scheduleMeaning).collect(Collectors.joining(", "))
                + (e.preferenceDeadline() == null ? "" : " (срок: " + e.preferenceDeadline() + ")"))
                .collect(Collectors.joining("\n"));
    }
    private String scheduleMeaning(PositionChangeScheduleEffectType type) {
        return switch (type) {
            case OLD_PARTICIPATION_REMOVED -> "прежнее участие удалено";
            case PREFERENCE_SUBMISSION_REMOVED -> "прежние пожелания удалены";
            case NEW_PARTICIPATION_CREATED -> "участие обновлено";
            case COLLECTION_REOPENED -> "сбор пожеланий открыт повторно";
            case AUTO_BUILD_RESULT_STALE -> "результат автосборки устарел, график стоит проверить";
            case AUTO_BUILD_RESULT_INVALIDATED -> "результат автосборки сброшен, после сбора пожеланий потребуется повторная сборка";
            case DRAFT_EMPLOYEE_REMOVED -> "сотрудник удалён из черновика";
            case PUBLISHED_FUTURE_SHIFTS_CANCELLED -> "будущие смены отменены";
            case PUBLISHED_ROW_BECAME_HISTORICAL -> "строка прежней должности сохранена в истории";
        };
    }
    private String certMeaning(CertificationAudienceEffectType type) {
        return switch (type) {
            case CREATED -> "назначена";
            case REACTIVATED -> "назначение возобновлено";
            case AUDIENCE_REMOVED -> "исключён(а) из аудитории";
            case UNCHANGED -> "без изменений";
        };
    }
    private Map<String, Object> metadata(RestaurantMember subject, List<Long> ids) {
        return Map.of("resourceIds", ids.stream().sorted().toList(), "memberId", subject.getId());
    }
    private BusinessNotificationCommand command(RestaurantMember subject, User actor, UUID operationId,
                                                RestaurantMember recipient, BusinessNotificationKind kind,
                                                String inbox, String push, Map<String, Object> metadata) {
        return new BusinessNotificationCommand(subject.getRestaurant(), operationId, recipient, actor, kind,
                inbox, push, metadata, null);
    }
}
