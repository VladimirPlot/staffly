package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleAutoBuildPositionPreviewDto(
        Long positionId,
        String positionName,
        List<ScheduleAutoBuildCellPreviewDto> cells,
        List<String> warnings,
        int totalAssignments,
        int warningsCount,
        int unfilledCount,
        int negativeAssignmentsCount
) {
}
