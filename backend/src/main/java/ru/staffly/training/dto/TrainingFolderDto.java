package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.staffly.training.model.TrainingFolderType;

public record TrainingFolderDto(
        Long id,
        @NotNull Long restaurantId,
        Long parentId,
        @NotBlank @Size(max = 150) String name,
        String description,
        @NotNull TrainingFolderType type,
        Integer sortOrder,
        Boolean active
) {}
