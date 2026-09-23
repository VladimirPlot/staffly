package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record UpsertMySchedulePreferenceRequest(
        @NotNull Integer expectedRevision,
        List<SchedulePreferenceCellRequest> cells,
        String periodComment
) {}
