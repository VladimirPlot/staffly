package ru.staffly.schedule.dto;

import java.time.LocalTime;

public record SaveScheduleBuildShiftOptionRequest(
        LocalTime startTime,
        LocalTime endTime,
        String label,
        Integer sortOrder
) {}
