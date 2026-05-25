package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleAutoBuildPreviewResponse(
        Long scheduleId,
        Long templateId,
        String templateName,
        List<ScheduleAutoBuildPositionPreviewDto> positions,
        List<String> warnings,
        int totalAssignments,
        int warningsCount,
        int unfilledCount,
        int negativeAssignmentsCount
) {
}
