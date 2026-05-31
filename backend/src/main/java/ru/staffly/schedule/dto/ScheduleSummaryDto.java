package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

public record ScheduleSummaryDto(
        Long id,
        String title,
        String startDate,
        String endDate,
        Instant createdAt,
        boolean hasPendingShiftRequests,
        List<Long> positionIds,
        ScheduleOwnerDto owner,
        ScheduleStatus status,
        Instant preferenceCollectionStartedAt,
        Instant preferenceDeadline,
        Instant preferenceClosedAt,
        Instant preferenceAppliedAt,
        Integer preferenceSubmittedCount,
        Integer preferenceTotalParticipants,
        Boolean myPreferenceSubmitted
) {}
