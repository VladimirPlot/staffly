package ru.staffly.schedule.dto;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

public record SaveScheduleBuildWeekdayRegimeRequest(
        List<DayOfWeek> daysOfWeek,
        LocalTime workPeriodStart,
        LocalTime workPeriodEnd,
        List<SaveScheduleBuildShiftOptionRequest> shiftOptions,
        List<SaveScheduleBuildCoverageRuleRequest> coverageRules,
        List<SaveScheduleBuildCoverageDateOverrideRequest> coverageDateOverrides,
        Integer sortOrder
) {}
