package ru.staffly.schedule.dto;

import java.time.LocalTime;

public record SchedulePreferenceAllowedShiftOptionDto(
        Long id,
        String label,
        LocalTime startTime,
        LocalTime endTime
) {}
