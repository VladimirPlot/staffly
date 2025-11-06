package ru.staffly.schedule.dto;

import java.time.Instant;

public record ScheduleSummaryDto(
        Long id,
        String title,
        String startDate,
        String endDate,
        Instant createdAt
) {}