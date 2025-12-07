package ru.staffly.schedule.dto;

import java.time.Instant;
import java.util.List;

public record ScheduleSummaryDto(
        Long id,
        String title,
        String startDate,
        String endDate,
        Instant createdAt,
        boolean hasPendingShiftRequests,
        List<Long> positionIds
) {}