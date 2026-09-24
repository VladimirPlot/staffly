package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleBuildMinRestMode;
import ru.staffly.schedule.model.ScheduleBuildPattern;

import java.util.List;

public record SaveScheduleBuildPositionConfigRequest(
        List<Long> positionIds,
        ScheduleBuildPattern targetPattern,
        Integer minRestHours,
        ScheduleBuildMinRestMode minRestMode,
        Integer maxShiftsPerPeriod,
        List<Integer> heavyDaysOfWeek,
        List<SaveScheduleBuildWeekdayRegimeRequest> weekdayRegimes,
        List<SaveScheduleBuildMarkerRequest> markers,
        Integer sortOrder
) {
    public SaveScheduleBuildPositionConfigRequest(List<Long> positionIds, ScheduleBuildPattern targetPattern,
                                                   Integer minRestHours, ScheduleBuildMinRestMode minRestMode,
                                                   Integer maxShiftsPerPeriod, List<Integer> heavyDaysOfWeek,
                                                   List<SaveScheduleBuildWeekdayRegimeRequest> weekdayRegimes,
                                                   Integer sortOrder) {
        this(positionIds, targetPattern, minRestHours, minRestMode, maxShiftsPerPeriod,
                heavyDaysOfWeek, weekdayRegimes, List.of(), sortOrder);
    }
}
