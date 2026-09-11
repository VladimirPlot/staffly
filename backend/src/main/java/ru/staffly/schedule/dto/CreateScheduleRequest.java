package ru.staffly.schedule.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;

public record CreateScheduleRequest(
        String title,
        @Valid @NotNull ScheduleConfigDto config,
        @Valid List<ScheduleRowRequest> rows,
        Map<String, String> cellValues,
        Long ownerUserId
) {
}
