package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record AdjustedScheduleAutoBuildAssignmentDto(
        @NotNull Long memberId,
        String memberName,
        @NotNull Long positionId,
        @NotNull String day,
        String value,
        Long shiftOptionId,
        String shiftLabel,
        @NotNull String startTime,
        @NotNull String endTime,
        String reason,
        String matchStatus,
        String warningMessage
) {
}
