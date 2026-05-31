package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record ApplyScheduleAutoBuildRequest(
        @NotNull Long templateId
) {
}
