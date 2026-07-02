package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleBuildMinRestMode;
import ru.staffly.schedule.model.ScheduleBuildPattern;

import java.time.LocalTime;
import java.util.List;

public record SaveScheduleBuildPositionConfigRequest(
        Long positionId,
        LocalTime fullShiftStart,
        LocalTime fullShiftEnd,
        ScheduleBuildPattern targetPattern,
        Integer minRestHours,
        ScheduleBuildMinRestMode minRestMode,
        Integer maxShiftsPerPeriod,
        List<Integer> heavyDaysOfWeek,
        List<SaveScheduleBuildShiftOptionRequest> shiftOptions,
        List<SaveScheduleBuildCoverageRuleRequest> coverageRules,
        Integer sortOrder
) {}
