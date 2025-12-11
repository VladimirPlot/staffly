package ru.staffly.anonymousletter.dto;

import java.time.Instant;

public record AnonymousLetterDto(
        Long id,
        String subject,
        String content,
        Instant createdAt,
        Instant readAt,
        String recipientName,
        String recipientPosition
) {}