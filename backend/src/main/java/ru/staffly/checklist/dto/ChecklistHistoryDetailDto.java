package ru.staffly.checklist.dto;

import java.util.List;

public record ChecklistHistoryDetailDto(
        Long id,
        Long checklistId,
        String checklistName,
        String kind,
        String periodicity,
        String resetTime,
        Integer resetDayOfWeek,
        Integer resetDayOfMonth,
        String startedAt,
        String resetAt,
        String resetReason,
        boolean completed,
        int totalItems,
        int completedItems,
        String positionsSnapshot,
        List<ChecklistHistoryItemDto> items
) {
}
