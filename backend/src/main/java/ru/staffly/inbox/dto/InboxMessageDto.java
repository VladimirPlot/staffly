package ru.staffly.inbox.dto;

import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.model.InboxMessageType;

import java.time.Instant;
import java.time.LocalDate;

public record InboxMessageDto(
        Long id,
        InboxMessageType type,
        InboxEventSubtype eventSubtype,
        String content,
        LocalDate expiresAt,
        Instant createdAt,
        InboxAuthorDto createdBy,
        boolean isRead,
        boolean isArchived,
        boolean isExpired
) {
}