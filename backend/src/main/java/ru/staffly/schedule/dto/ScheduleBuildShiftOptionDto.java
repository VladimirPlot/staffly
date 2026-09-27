package ru.staffly.schedule.dto;

import java.time.LocalTime;

public record ScheduleBuildShiftOptionDto(
        Long id,
        LocalTime startTime,
        LocalTime endTime,
        String label,
        Integer sortOrder,
        Long markerId
) {
    public ScheduleBuildShiftOptionDto(Long id, LocalTime startTime, LocalTime endTime,
                                       String label, Integer sortOrder) {
        this(id, startTime, endTime, label, sortOrder, null);
    }
}
