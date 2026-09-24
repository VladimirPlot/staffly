package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleBuildMinRestMode;
import ru.staffly.schedule.model.ScheduleBuildPattern;

import java.util.List;

public record SaveScheduleBuildPositionConfigRequest(
        Long id,
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
                                                   List<SaveScheduleBuildMarkerRequest> markers,
                                                   Integer sortOrder) {
        this(null, positionIds, targetPattern, minRestHours, minRestMode, maxShiftsPerPeriod,
                heavyDaysOfWeek, weekdayRegimes, markers, sortOrder);
    }

    public SaveScheduleBuildPositionConfigRequest(List<Long> positionIds, ScheduleBuildPattern targetPattern,
                                                   Integer minRestHours, ScheduleBuildMinRestMode minRestMode,
                                                   Integer maxShiftsPerPeriod, List<Integer> heavyDaysOfWeek,
                                                   List<SaveScheduleBuildWeekdayRegimeRequest> weekdayRegimes,
                                                   Integer sortOrder) {
        this(null, positionIds, targetPattern, minRestHours, minRestMode, maxShiftsPerPeriod,
                heavyDaysOfWeek, weekdayRegimes, List.of(), sortOrder);
    }
}
