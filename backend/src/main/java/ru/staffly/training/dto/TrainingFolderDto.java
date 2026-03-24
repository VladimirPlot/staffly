package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingFolderType;

import java.util.List;

public record TrainingFolderDto(
        Long id,
        Long restaurantId,
        Long parentId,
        String name,
        String description,
        TrainingFolderType type,
        Integer sortOrder,
        Boolean active,
        List<Long> visibilityPositionIds
) {}
