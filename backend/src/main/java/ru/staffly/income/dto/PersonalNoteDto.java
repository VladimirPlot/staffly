package ru.staffly.income.dto;

import java.time.Instant;

public record PersonalNoteDto(
        Long id,
        String title,
        String content,
        Instant createdAt,
        Instant updatedAt
) {
}