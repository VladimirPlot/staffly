package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotNull;

public record MasterScheduleWeekTemplatePositionRequest(
        @NotNull Long positionId
) {}
