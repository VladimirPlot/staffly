package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record PreviewScheduleAutoBuildRequest(
        @NotNull Long templateId
) {
}
