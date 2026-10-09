package ru.staffly.task.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record TaskAssignRequest(
        @NotNull @Positive Long memberId,
        @NotNull @Min(0) Long expectedVersion
) {}
