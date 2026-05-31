package ru.staffly.schedule.dto;

import java.time.LocalTime;

public record ScheduleBuildCoverageRuleDto(
        Long id,
        Integer dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        Integer requiredCount,
        Integer sortOrder
) {}
