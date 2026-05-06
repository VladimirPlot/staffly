package ru.staffly.schedule.dto;

import java.time.Instant;

public record ScheduleAuditLogDto(
        Long id,
        String action,
        Long actorUserId,
        String actorDisplayName,
        String details,
        Instant createdAt
) {}