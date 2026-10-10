package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.task.lifecycle.TaskTerminationResult;
import ru.staffly.schedule.lifecycle.ScheduleTerminationResult;
import ru.staffly.training.lifecycle.CertificationTerminationResult;
import ru.staffly.user.model.User;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TerminationNotificationService {
    private final InboxMessageService inbox;
    private final RestaurantMemberRepository members;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void notify(Restaurant restaurant, User actor, UUID operationId, TaskTerminationResult result,
                       ScheduleTerminationResult schedules, CertificationTerminationResult certifications) {
        notifyTransfers(restaurant, actor, operationId, result.assigneeTransfers(), BusinessNotificationKind.TASK_ASSIGNMENT,
                "Вам передали задачу", "задачи");
        notifyTransfers(restaurant, actor, operationId, result.setterTransfers(), BusinessNotificationKind.TASK_RESPONSIBILITY,
                "Вам передали ответственность за задачу", "ответственность за задачи");
        result.orphans().stream().filter(o -> o.setterMemberId() != null)
                .collect(Collectors.groupingBy(TaskTerminationResult.Orphan::setterMemberId)).forEach((memberId, values) -> {
                    RestaurantMember recipient = members.findById(memberId).orElse(null);
                    if (recipient == null || recipient.getEndedAt() != null) return;
                    String text = values.size() == 1 ? "Задача «" + values.get(0).title() + "» осталась без исполнителя. Назначьте нового."
                            : values.size() + " задачи остались без исполнителя. Назначьте новых.";
                    inbox.createBusinessNotification(new BusinessNotificationCommand(restaurant, operationId, recipient, actor,
                            BusinessNotificationKind.TASK_ORPHANED, text, text, null, null));
                });
        schedules.ownershipTransfers().stream().collect(Collectors.groupingBy(t -> t.newOwnerUserId())).forEach((userId, values) ->
                notifyOwner(restaurant, actor, operationId, userId, BusinessNotificationKind.SCHEDULE,
                        values.size() == 1 ? "Вам передали ответственность за график «" + values.get(0).title() + "»."
                                : "Вам передали ответственность за " + values.size() + " графиков."));
        certifications.ownershipTransfers().stream().filter(t -> t.active()).collect(Collectors.groupingBy(t -> t.newOwnerUserId())).forEach((userId, values) ->
                notifyOwner(restaurant, actor, operationId, userId, BusinessNotificationKind.CERTIFICATION,
                        values.size() == 1 ? "Вам передали ответственность за аттестацию «" + values.get(0).title() + "»."
                                : "Вам передали ответственность за " + values.size() + " аттестаций."));
        schedules.affectedSchedules().stream().filter(e -> e.ownerUserId() != null)
                .collect(Collectors.groupingBy(ScheduleTerminationResult.AffectedSchedule::ownerUserId))
                .forEach((userId, effects) -> {
                    int shifts = effects.stream().mapToInt(ScheduleTerminationResult.AffectedSchedule::futureShiftsCancelled).sum();
                    long stale = effects.stream().filter(ScheduleTerminationResult.AffectedSchedule::autoBuildBecameStale).count();
                    String text = "Изменено графиков после завершения membership сотрудника: " + effects.size()
                            + (shifts == 0 ? "." : ". Очищено будущих смен: " + shifts + ".")
                            + (stale == 0 ? "" : " Результат автосборки устарел: " + stale + ".");
                    notifyOwner(restaurant, actor, operationId, userId, BusinessNotificationKind.SCHEDULE_LIFECYCLE, text);
                });
    }

    private void notifyOwner(Restaurant restaurant, User actor, UUID operationId, Long userId,
                             BusinessNotificationKind kind, String text) {
        RestaurantMember recipient = members.findActiveByUserIdAndRestaurantId(userId, restaurant.getId()).orElse(null);
        if (recipient != null) inbox.createBusinessNotification(new BusinessNotificationCommand(
                restaurant, operationId, recipient, actor, kind, text, text, null, null));
    }

    private void notifyTransfers(Restaurant restaurant, User actor, UUID operationId,
            List<TaskTerminationResult.Transfer> transfers, BusinessNotificationKind kind,
            String singlePrefix, String plural) {
        transfers.stream().collect(Collectors.groupingBy(TaskTerminationResult.Transfer::memberId)).forEach((memberId, values) -> {
            RestaurantMember recipient = members.findById(memberId).orElse(null);
            if (recipient == null || recipient.getEndedAt() != null) return;
            String text = values.size() == 1 ? singlePrefix + " «" + values.get(0).title() + "»."
                    : "Вам передали " + values.size() + " " + plural + ".";
            inbox.createBusinessNotification(new BusinessNotificationCommand(restaurant, operationId, recipient, actor,
                    kind, text, text, null, null));
        });
    }
}
