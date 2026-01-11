package ru.staffly.inbox.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class InboxRetentionJob {

    private final InboxMessageRepository messages;
    private final InboxRecipientRepository recipients;

    @Scheduled(cron = "0 45 2 * * *")
    @Transactional
    public void cleanupInbox() {
        LocalDate today = LocalDate.now();
        Instant now = Instant.now();

        LocalDate announcementExpiresBefore = today.minusDays(30);
        Instant announcementCreatedBefore = now.minus(30, ChronoUnit.DAYS);
        LocalDate birthdayExpiresBefore = today.minusDays(7);
        Instant eventCreatedBefore = now.minus(30, ChronoUnit.DAYS);

        int announcementsRemoved = deleteMessages(messages.findAnnouncementIdsForCleanup(
                InboxMessageType.ANNOUNCEMENT,
                announcementExpiresBefore,
                announcementCreatedBefore
        ));
        int eventsRemoved = deleteMessages(messages.findEventIdsForCleanup(
                InboxMessageType.EVENT,
                eventCreatedBefore
        ));
        int birthdaysRemoved = deleteMessages(messages.findBirthdayIdsForCleanup(
                InboxMessageType.BIRTHDAY,
                birthdayExpiresBefore
        ));

        log.info("Inbox retention cleanup completed: announcements={}, events={}, birthdays={}",
                announcementsRemoved, eventsRemoved, birthdaysRemoved);
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