package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleBuildMinRestMode;
import ru.staffly.schedule.model.ScheduleBuildPattern;

import java.time.LocalTime;
import java.util.List;

public record ScheduleBuildPositionConfigDto(
        Long id,
        List<Long> positionIds,
        List<String> positionNames,
        LocalTime fullShiftStart,
        LocalTime fullShiftEnd,
        ScheduleBuildPattern targetPattern,
        Integer minRestHours,
        ScheduleBuildMinRestMode minRestMode,
        Integer maxShiftsPerPeriod,
        List<Integer> heavyDaysOfWeek,
        List<ScheduleBuildShiftOptionDto> shiftOptions,
        List<ScheduleBuildCoverageRuleDto> coverageRules,
        List<ScheduleBuildCoverageDateOverrideDto> coverageDateOverrides,
        Integer sortOrder
) {}
