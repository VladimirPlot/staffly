package ru.staffly.inbox.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class InboxRetentionJob {

    private final InboxMessageRepository messages;
    private final InboxRecipientRepository recipients;
    private final RestaurantRepository restaurants;
    private final RestaurantTimeService restaurantTime;

    @Scheduled(cron = "0 45 * * * *")
    @Transactional
    public void cleanupInbox() {
        Instant now = restaurantTime.nowInstant();
        int eventsRemoved = 0;
        int birthdaysRemoved = 0;

        for (Restaurant restaurant : restaurants.findAll()) {
            ZoneId zone = restaurantTime.zoneFor(restaurant);
            LocalDate today = restaurantTime.today(restaurant);
            if (now.atZone(zone).getHour() != 2) {
                continue;
            }

            LocalDate birthdayExpiresBefore = today.minusDays(7);
            Instant eventCreatedBefore = now.minus(30, ChronoUnit.DAYS);

            eventsRemoved += deleteMessages(messages.findEventIdsForCleanup(
                    InboxMessageType.EVENT,
                    restaurant.getId(),
                    eventCreatedBefore
            ));
            birthdaysRemoved += deleteMessages(messages.findBirthdayIdsForCleanup(
                    InboxMessageType.BIRTHDAY,
                    restaurant.getId(),
                    birthdayExpiresBefore
            ));
        }

        if (eventsRemoved + birthdaysRemoved > 0) {
            log.info("Inbox retention cleanup completed: events={}, birthdays={}",
                    eventsRemoved, birthdaysRemoved);
        }
    }

    private int deleteMessages(List<Long> messageIds) {
        if (messageIds == null || messageIds.isEmpty()) {
            return 0;
        }
        recipients.deleteByMessageIdIn(messageIds);
        messages.deleteAllByIdInBatch(messageIds);
        return messageIds.size();
    }
}
