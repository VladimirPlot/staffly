package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateReplacementShiftRequest(
        @NotBlank String day,
        @NotNull Long toMemberId,
        String reason
) {
}