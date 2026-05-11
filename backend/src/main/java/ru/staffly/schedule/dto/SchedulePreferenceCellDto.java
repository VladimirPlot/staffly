package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.SchedulePreferenceType;

public record SchedulePreferenceCellDto(
        Long id,
        String day,
        SchedulePreferenceType type,
        boolean fullDay,
        String startTime,
        String endTime,
        String note,
        int sortOrder
) {}
