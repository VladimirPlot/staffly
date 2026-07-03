package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleAutoBuildPositionPreviewDto(
        Long positionConfigId,
        String positionName,
        List<Long> positionIds,
        List<ScheduleAutoBuildCellPreviewDto> cells,
        List<String> warnings,
        int totalAssignments,
        int warningsCount,
        int unfilledCount,
        int negativeAssignmentsCount
) {
}
