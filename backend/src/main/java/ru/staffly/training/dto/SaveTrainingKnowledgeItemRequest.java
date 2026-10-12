package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** One form submission, including the intended photo action. */
public record SaveTrainingKnowledgeItemRequest(
        @NotNull UUID creationRequestId,
        @Positive Long itemId,
        @Positive Long folderId,
        @NotBlank @Size(max = 150) String title,
        String description,
        String composition,
        String allergens,
        Integer sortOrder,
        boolean removeImage
) {}
