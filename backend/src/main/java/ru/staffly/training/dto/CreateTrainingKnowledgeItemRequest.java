package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTrainingKnowledgeItemRequest(
        Long folderId,
        @NotBlank @Size(max = 150) String title,
        String description,
        String composition,
        String allergens,
        String imageUrl,
        Integer sortOrder
) {}
