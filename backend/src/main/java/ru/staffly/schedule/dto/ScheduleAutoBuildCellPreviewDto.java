package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleAutoBuildCellPreviewDto(
        Long memberId,
        String memberName,
        String day,
        String value,
        Long shiftOptionId,
        String shiftLabel,
        String reason,
        List<String> warnings
) {
}
