package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleAutoBuildPreviewResponse(
        Long scheduleId,
        Long templateId,
        Long effectiveBuildTemplateId,
        String templateName,
        List<ScheduleAutoBuildPositionPreviewDto> positions,
        List<String> warnings,
        List<ScheduleAutoBuildUncoveredSlotDto> uncoveredSlots,
        int totalAssignments,
        int warningsCount,
        int unfilledCount,
        int negativeAssignmentsCount
) {
}
