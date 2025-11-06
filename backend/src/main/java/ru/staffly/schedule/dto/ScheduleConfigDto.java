package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleShiftMode;

import java.util.List;

public record ScheduleConfigDto(
        String startDate,
        String endDate,
        List<Long> positionIds,
        boolean showFullName,
        ScheduleShiftMode shiftMode
) {}