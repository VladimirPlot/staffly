package ru.staffly.checklist.dto;

import java.util.List;

public record ChecklistDto(
        Long id,
        Long restaurantId,
        String name,
        String content,
        List<ChecklistPositionDto> positions
) {
}