package ru.staffly.inbox.service;

import java.util.UUID;

/** Server-side factory for the identity shared by notification groups from one command. */
public final class BusinessNotificationOperationId {
    private BusinessNotificationOperationId() {
    }

    public static UUID generate() {
        return UUID.randomUUID();
    }
}
