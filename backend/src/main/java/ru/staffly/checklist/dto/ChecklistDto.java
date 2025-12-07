package ru.staffly.checklist.dto;

import java.util.List;

public record ChecklistDto(
        Long id,
        Long restaurantId,
        String name,
        String content,
        String kind,
        String periodicity,
        boolean completed,
        String periodLabel,
        String resetTime,
        Integer resetDayOfWeek,
        Integer resetDayOfMonth,
        List<ChecklistItemDto> items,
        List<ChecklistPositionDto> positions
) {
}