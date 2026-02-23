package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateTrainingFolderRequest(
        @NotBlank @Size(max = 150) String name,
        String description,
        Integer sortOrder
) {}
