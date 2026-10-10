package ru.staffly.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record ChecklistItemRequest(
        @Positive Long id,
        @NotBlank @Size(max = 4000) String text,
        String completionPhotoMode,
        Boolean completionPhotoRequired
) {
}
