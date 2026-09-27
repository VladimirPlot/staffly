package ru.staffly.schedule.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ApplyScheduleAutoBuildRequest(
        @NotNull Long version,
        @NotNull Long templateId,
        @NotNull String previewToken,
        @Valid List<AdjustedScheduleAutoBuildAssignmentDto> adjustedAssignments
) {
}
