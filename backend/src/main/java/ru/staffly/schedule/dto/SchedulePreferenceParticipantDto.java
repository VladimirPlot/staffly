package ru.staffly.schedule.dto;

import java.time.Instant;

public record SchedulePreferenceParticipantDto(
        Long memberId,
        Long userId,
        String displayName,
        Long positionId,
        String positionName,
        boolean submitted,
        Instant submittedAt,
        Instant updatedAt,
        int revision,
        int cellsCount
) {}
