package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TrainingItemDto(
        Long id,
        Long categoryId,
        @NotBlank @Size(max = 150) String name,
        String description,
        String composition,   // для MENU (опц.)
        String allergens,     // для MENU (опц.)
        String imageUrl,      // общий (опц.)
        Integer sortOrder,
        Boolean active
) {}