package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.SchedulePreferenceType;

public record SchedulePreferenceCellRequest(
        String day,
        SchedulePreferenceType type,
        Boolean fullDay,
        String startTime,
        String endTime,
        String note
) {}
