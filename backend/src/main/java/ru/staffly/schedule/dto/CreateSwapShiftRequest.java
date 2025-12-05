package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateSwapShiftRequest(
        @NotBlank String myDay,
        @NotNull Long targetMemberId,
        @NotBlank String targetDay,
        String reason
) {
}