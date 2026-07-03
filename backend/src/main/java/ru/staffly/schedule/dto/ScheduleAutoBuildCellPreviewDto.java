package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleAutoBuildCellPreviewDto(
        Long memberId,
        String memberName,
        Long positionId,
        String day,
        String value,
        Long shiftOptionId,
        String shiftLabel,
        String startTime,
        String endTime,
        String reason,
        String matchStatus,
        String warningMessage,
        List<String> warnings
) {
}
