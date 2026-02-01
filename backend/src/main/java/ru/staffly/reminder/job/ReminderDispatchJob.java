package ru.staffly.reminder.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
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
import ru.staffly.reminder.service.ReminderScheduleCalculator;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReminderDispatchJob {

    private final RestaurantRepository restaurants;
    private final ReminderRepository reminders;
    private final RestaurantMemberRepository members;
    private final InboxMessageService inboxMessages;
    private final InboxMessageRepository inboxMessageRepository;
    private final RestaurantTimeService restaurantTime;

    @Scheduled(cron = "0 */2 * * * *")
    @Transactional
    public void dispatchReminders() {
        Instant now = restaurantTime.nowInstant();
        List<Restaurant> allRestaurants = restaurants.findAll();
        for (Restaurant restaurant : allRestaurants) {
            List<Reminder> dueReminders = reminders.findDueReminders(restaurant.getId(), now);
            if (dueReminders.isEmpty()) {
                continue;
            }
            List<RestaurantMember> memberList = members.findWithUserByRestaurantId(restaurant.getId()).stream()
                    .filter(member -> member.getUser() != null)
                    .toList();
            Map<Long, RestaurantMember> memberById = memberList.stream()
                    .filter(member -> member.getId() != null)
                    .collect(Collectors.toMap(RestaurantMember::getId, Function.identity(), (first, second) -> first));

            for (Reminder reminder : dueReminders) {
                try {
                    processReminder(restaurant, reminder, memberList, memberById, now);
                } catch (Exception ex) {
                    log.error("Failed to process reminder {} for restaurant {}", reminder.getId(), restaurant.getId(), ex);
                }
            }
        }
        log.info("Reminder dispatch job completed");
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
            if (reminder.getTargetPosition() == null) {
                return List.of();
            }
            Long positionId = reminder.getTargetPosition().getId();
            return memberList.stream()
                    .filter(member -> member.getPosition() != null && positionId.equals(member.getPosition().getId()))
                    .toList();
        }
        if (reminder.getTargetType() == ReminderTargetType.MEMBER) {
            if (reminder.getTargetMember() == null) {
                return List.of();
            }
            RestaurantMember member = memberById.get(reminder.getTargetMember().getId());
            return member == null ? List.of() : List.of(member);
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
