package ru.staffly.schedule.dto;

import java.time.LocalTime;

public record ScheduleBuildShiftOptionDto(
        Long id,
        LocalTime startTime,
        LocalTime endTime,
        String label,
        boolean isFullShift,
        Integer sortOrder
) {}
