package ru.staffly.inbox.service;

import ru.staffly.inbox.model.InboxMessage;

public record BusinessNotificationResult(Status status, InboxMessage message) {
    public enum Status {
        CREATED,
        DEDUPLICATED,
        SUPPRESSED_ACTOR,
        SUPPRESSED_NO_RECIPIENT
    }

    public static BusinessNotificationResult created(InboxMessage message) {
        return new BusinessNotificationResult(Status.CREATED, message);
    }

    public static BusinessNotificationResult deduplicated(InboxMessage message) {
        return new BusinessNotificationResult(Status.DEDUPLICATED, message);
    }

    public static BusinessNotificationResult suppressed(Status status) {
        return new BusinessNotificationResult(status, null);
    }
}
