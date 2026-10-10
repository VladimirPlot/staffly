package ru.staffly.reminder.service;

import lombok.RequiredArgsConstructor;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.reminder.model.Reminder;
import ru.staffly.reminder.model.ReminderPeriodicity;
import ru.staffly.reminder.model.ReminderTargetType;
import ru.staffly.reminder.repository.ReminderRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReminderDispatchService {

    private final RestaurantLifecycleMutex lifecycleMutex;
    private final ReminderRepository reminders;
    private final RestaurantMemberRepository members;
    private final InboxMessageService inboxMessages;
    private final InboxMessageRepository inboxMessageRepository;
    private final RestaurantTimeService restaurantTime;

    /** One restaurant per transaction; acquire the lifecycle mutex before loading mutable reminders. */
    @Transactional
    public void dispatchForRestaurant(Restaurant restaurant) {
        lifecycleMutex.lock(restaurant.getId());
        Instant now = restaurantTime.nowInstant();
        List<Reminder> dueReminders = reminders.findDueReminders(restaurant.getId(), now);
        if (dueReminders.isEmpty()) return;
        List<RestaurantMember> memberList = members.findActiveWithUserByRestaurantId(restaurant.getId()).stream()
                .filter(member -> member.getUser() != null).toList();
        Map<Long, RestaurantMember> memberById = memberList.stream()
                .filter(member -> member.getId() != null)
                .collect(Collectors.toMap(RestaurantMember::getId, Function.identity(), (first, second) -> first));
        for (Reminder reminder : dueReminders) {
            processReminder(restaurant, reminder, memberList, memberById, now);
        }
    }

    private void processReminder(Restaurant restaurant,
                                 Reminder reminder,
                                 List<RestaurantMember> memberList,
                                 Map<Long, RestaurantMember> memberById,
                                 Instant now) {
        Instant fireAt = reminder.getNextFireAt();
        if (fireAt == null) {
            reminder.setActive(false);
            reminder.setNextFireAt(null);
            reminders.save(reminder);
            return;
        }
        String meta = String.format("reminder:%d:%d", reminder.getId(), fireAt.toEpochMilli());
        boolean alreadySent = inboxMessageRepository.existsByRestaurantIdAndTypeAndMeta(
                restaurant.getId(),
                InboxMessageType.EVENT,
                meta
        );

        if (!alreadySent) {
            List<RestaurantMember> recipients = resolveRecipients(reminder, memberList, memberById);
            if (!recipients.isEmpty()) {
                String content = buildContent(reminder);
                User creator = reminder.getCreatedByMember() != null ? reminder.getCreatedByMember().getUser() : null;
                inboxMessages.createEvent(
                        restaurant,
                        creator,
                        content,
                        InboxEventSubtype.REMINDER,
                        meta,
                        recipients,
                        resolveExpiresAt(restaurant)
                );
            }
        }

        Instant nextFireAt = null;
        boolean active = reminder.isActive();
        if (reminder.getPeriodicity() == ReminderPeriodicity.ONCE) {
            active = false;
        } else {
            ZoneId zone = restaurantTime.zoneFor(restaurant);
            nextFireAt = ReminderScheduleCalculator.computeNextFire(now, reminder, zone);
        }

        reminder.setLastFiredAt(now);
        reminder.setActive(active);
        reminder.setNextFireAt(nextFireAt);
        reminders.save(reminder);
    }

    private List<RestaurantMember> resolveRecipients(Reminder reminder,
                                                     List<RestaurantMember> memberList,
                                                     Map<Long, RestaurantMember> memberById) {
        if (reminder.getTargetType() == ReminderTargetType.ALL) {
            return memberList;
        }
        if (reminder.getTargetType() == ReminderTargetType.POSITION) {
            var positionIds = reminder.effectivePositions().stream().map(position -> position.getId())
                    .collect(Collectors.toSet());
            return memberList.stream()
                    .filter(member -> member.getPosition() != null && positionIds.contains(member.getPosition().getId()))
                    .toList();
        }
        if (reminder.getTargetType() == ReminderTargetType.MEMBER) {
            return reminder.effectiveMembers().stream().map(member -> memberById.get(member.getId()))
                    .filter(java.util.Objects::nonNull).toList();
        }
        return List.of();
    }

    private String buildContent(Reminder reminder) {
        String title = reminder.getTitle() == null ? "" : reminder.getTitle().trim();
        String description = reminder.getDescription() == null ? "" : reminder.getDescription().trim();
        if (description.isBlank()) {
            return "Напоминание: " + title;
        }
        return "Напоминание: " + title + "\n" + description;
    }

    private LocalDate resolveExpiresAt(Restaurant restaurant) {
        return restaurantTime.today(restaurant).plusDays(30);
    }
}
