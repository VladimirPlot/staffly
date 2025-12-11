package ru.staffly.anonymousletter.dto;

import java.time.Instant;

public record AnonymousLetterSummaryDto(
        Long id,
        String subject,
        Instant createdAt,
        Instant readAt,
        String recipientName,
        String recipientPosition
) {}