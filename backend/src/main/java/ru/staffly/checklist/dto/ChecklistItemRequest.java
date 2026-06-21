package ru.staffly.checklist.dto;

public record ChecklistItemRequest(
        Long id,
        String text,
        Boolean completionPhotoRequired
) {
}
