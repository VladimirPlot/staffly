package ru.staffly.inbox.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.inbox.repository.InboxRecipientRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class InboxRecipientLimitJob {

    private static final int INBOX_LIMIT = 200;

    private final InboxRecipientRepository recipients;

    @Scheduled(cron = "0 10 3 * * *")
    @Transactional
    public void enforceInboxRecipientLimit() {
        int removed = recipients.deleteOverflowRecipients(INBOX_LIMIT);
        if (removed > 0) {
            log.info("Inbox recipient limit cleanup removed {} rows", removed);
        }
    }
}