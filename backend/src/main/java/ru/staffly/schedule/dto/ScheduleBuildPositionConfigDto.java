package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleBuildMinRestMode;
import ru.staffly.schedule.model.ScheduleBuildPattern;

import java.util.List;

public record ScheduleBuildPositionConfigDto(
        Long id,
        List<Long> positionIds,
        List<String> positionNames,
        ScheduleBuildPattern targetPattern,
        Integer minRestHours,
        ScheduleBuildMinRestMode minRestMode,
        Integer maxShiftsPerPeriod,
        List<Integer> heavyDaysOfWeek,
        List<ScheduleBuildWeekdayRegimeDto> weekdayRegimes,
        List<ScheduleBuildMarkerDto> markers,
        Integer sortOrder
) {}
