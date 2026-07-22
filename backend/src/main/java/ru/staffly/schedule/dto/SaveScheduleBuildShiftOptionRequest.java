package ru.staffly.schedule.dto;

import java.time.LocalTime;

public record SaveScheduleBuildShiftOptionRequest(
        Long id,
        LocalTime startTime,
        LocalTime endTime,
        String label,
        Boolean isFullShift,
        Integer sortOrder
) {}
