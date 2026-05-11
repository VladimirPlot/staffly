package ru.staffly.schedule.dto;

import java.util.List;

public record UpsertMySchedulePreferenceRequest(
        List<SchedulePreferenceCellRequest> cells,
        String comment
) {}
