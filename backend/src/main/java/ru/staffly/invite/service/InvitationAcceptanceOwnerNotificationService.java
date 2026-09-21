package ru.staffly.invite.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationAfterCommitService;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.inbox.service.BusinessNotificationOperationId;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.dto.AppliedInvitationScheduleEffect;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
import ru.staffly.user.model.User;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationAcceptanceOwnerNotificationService {
    private final RestaurantMemberRepository members;
    private final BusinessNotificationAfterCommitService afterCommit;

    public void submit(RestaurantMember acceptedMember,
                       User actor,
                       List<AppliedInvitationScheduleEffect> scheduleEffects,
                       List<AppliedCertificationAudienceEffect> certificationEffects) {
        List<AppliedInvitationScheduleEffect> schedules = scheduleEffects.stream()
                .filter(effect -> effect.ownerUserId() != null)
                .sorted(Comparator.comparing(AppliedInvitationScheduleEffect::scheduleId))
                .toList();
        List<AppliedCertificationAudienceEffect> certifications = certificationEffects.stream()
                .filter(AppliedCertificationAudienceEffect::becameEffective)
                .filter(effect -> effect.ownerUserId() != null)
                .sorted(Comparator.comparing(AppliedCertificationAudienceEffect::certificationId))
                .toList();

        var ownerUserIds = new java.util.HashSet<Long>();
        schedules.forEach(effect -> ownerUserIds.add(effect.ownerUserId()));
        certifications.forEach(effect -> ownerUserIds.add(effect.ownerUserId()));
        if (ownerUserIds.isEmpty()) {
            return;
        }
        Long restaurantId = acceptedMember.getRestaurant().getId();
        Map<Long, RestaurantMember> recipients = members
                .findByRestaurantIdAndUserIdIn(restaurantId, ownerUserIds).stream()
                .filter(member -> member.getUser() != null)
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity(), (a, b) -> a));
        ownerUserIds.stream().filter(id -> !recipients.containsKey(id)).forEach(id ->
                log.warn("Skipping invitation resource-owner notification: owner is not a current member "
                        + "(restaurantId={}, ownerUserId={})", restaurantId, id));

        UUID operationId = BusinessNotificationOperationId.generate();
        List<BusinessNotificationCommand> commands = new ArrayList<>();
        schedules.stream().collect(Collectors.groupingBy(
                        AppliedInvitationScheduleEffect::ownerUserId, LinkedHashMap::new, Collectors.toList()))
                .forEach((ownerUserId, effects) -> addScheduleCommand(
                        commands, acceptedMember, actor, operationId, recipients.get(ownerUserId), effects));
        certifications.stream().collect(Collectors.groupingBy(
                        AppliedCertificationAudienceEffect::ownerUserId, LinkedHashMap::new, Collectors.toList()))
                .forEach((ownerUserId, effects) -> addCertificationCommand(
                        commands, acceptedMember, actor, operationId, recipients.get(ownerUserId), effects));
        afterCommit.submit(commands);
    }

    private void addScheduleCommand(List<BusinessNotificationCommand> commands, RestaurantMember member, User actor,
                                    UUID operationId, RestaurantMember recipient,
                                    List<AppliedInvitationScheduleEffect> effects) {
        if (recipient == null || effects.isEmpty()) return;
        commands.add(command(member, actor, recipient, operationId, BusinessNotificationKind.SCHEDULE,
                effects.stream().map(AppliedInvitationScheduleEffect::scheduleId).toList(),
                effects.stream().map(AppliedInvitationScheduleEffect::scheduleTitle).toList(), "график", "графика",
                "графиков", "графики", "ваш"));
    }

    private void addCertificationCommand(List<BusinessNotificationCommand> commands, RestaurantMember member, User actor,
                                         UUID operationId, RestaurantMember recipient,
                                         List<AppliedCertificationAudienceEffect> effects) {
        if (recipient == null || effects.isEmpty()) return;
        commands.add(command(member, actor, recipient, operationId, BusinessNotificationKind.CERTIFICATION,
                effects.stream().map(AppliedCertificationAudienceEffect::certificationId).toList(),
                effects.stream().map(AppliedCertificationAudienceEffect::certificationTitle).toList(),
                "аттестацию", "аттестации", "аттестаций", "аттестации", "вашу"));
    }

    private BusinessNotificationCommand command(RestaurantMember member, User actor, RestaurantMember recipient,
                                                UUID operationId, BusinessNotificationKind kind, List<Long> ids,
                                                List<String> titles, String one, String few, String many, String plural,
                                                String singularPossessive) {
        String employee = member.getUser().getFullName();
        String position = member.getPosition() == null ? null : member.getPosition().getName();
        String firstLine = "В ресторан добавлен " + employee
                + (position == null || position.isBlank() ? "." : " на должность " + position + ".");
        String inbox = firstLine + "\nОн добавлен в ваши " + plural + ":\n"
                + titles.stream().map(title -> "• " + title).collect(Collectors.joining("\n"));
        String possessive = ids.size() == 1 ? " " + singularPossessive + " " : " ваших ";
        String push = "В ресторан добавлен " + employee + ". Он добавлен в " + ids.size() + possessive
                + countForm(ids.size(), one, few, many) + ".";
        return new BusinessNotificationCommand(member.getRestaurant(), operationId, recipient, actor, kind,
                inbox, push, Map.of("resourceIds", ids, "memberId", member.getId()), null);
    }

    private String countForm(int count, String one, String few, String many) {
        int mod100 = count % 100;
        int mod10 = count % 10;
        if (mod100 >= 11 && mod100 <= 14) return many;
        if (mod10 == 1) return one;
        if (mod10 >= 2 && mod10 <= 4) return few;
        return many;
    }
}
