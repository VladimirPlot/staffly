package ru.staffly.schedule.dto;

import java.time.LocalTime;

public record SaveScheduleBuildCoverageRuleRequest(
        Integer dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        Integer requiredCount,
        Integer sortOrder
) {}
