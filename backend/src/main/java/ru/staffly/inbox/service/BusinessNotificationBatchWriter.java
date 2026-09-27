package ru.staffly.inbox.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BusinessNotificationBatchWriter {
    private final InboxMessageService inboxMessages;

    /** Runs only after the originating business transaction has committed. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(List<BusinessNotificationCommand> commands) {
        commands.forEach(inboxMessages::createBusinessNotification);
    }
}
