package ru.staffly.schedule.dto;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;

public record ScheduleBuildWeekdayRegimeDto(
        Long id,
        List<DayOfWeek> daysOfWeek,
        LocalTime workPeriodStart,
        LocalTime workPeriodEnd,
        List<ScheduleBuildShiftOptionDto> shiftOptions,
        List<ScheduleBuildCoverageRuleDto> coverageRules,
        List<ScheduleBuildCoverageDateOverrideDto> coverageDateOverrides,
        Integer sortOrder
) {}
