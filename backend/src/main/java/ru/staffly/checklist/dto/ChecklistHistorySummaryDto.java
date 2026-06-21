package ru.staffly.checklist.dto;

public record ChecklistHistorySummaryDto(
        Long id,
        Long checklistId,
        String checklistName,
        String resetAt,
        String resetReason,
        boolean completed,
        int totalItems,
        int completedItems,
        String positionsSnapshot
) {
}
