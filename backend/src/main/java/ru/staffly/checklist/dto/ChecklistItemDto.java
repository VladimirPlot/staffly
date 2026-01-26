package ru.staffly.checklist.dto;

public record ChecklistItemDto(
        Long id,
        String text,
        boolean done,
        ChecklistMemberShortDto doneBy,
        String doneAt,
        ChecklistMemberShortDto reservedBy,
        String reservedAt
) {
}