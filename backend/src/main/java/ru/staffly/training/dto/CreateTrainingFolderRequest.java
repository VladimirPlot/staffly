package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.staffly.training.model.TrainingFolderType;

import java.util.List;

public record CreateTrainingFolderRequest(
        Long parentId,
        @NotBlank @Size(max = 150) String name,
        String description,
        @NotNull TrainingFolderType type,
        Integer sortOrder,
        List<Long> visibilityPositionIds
) {}
