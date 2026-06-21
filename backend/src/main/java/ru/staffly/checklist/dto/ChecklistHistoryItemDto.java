package ru.staffly.checklist.dto;

public record ChecklistHistoryItemDto(
        Long id,
        Long sourceItemId,
        int itemOrder,
        String text,
        boolean done,
        ChecklistMemberShortDto doneBy,
        String doneByName,
        String doneAt,
        ChecklistMemberShortDto reservedBy,
        String reservedByName,
        String reservedAt,
        boolean completionPhotoRequired,
        String examplePhotoUrl,
        String completionPhotoUrl
) {
}
