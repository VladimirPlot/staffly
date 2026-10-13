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
        List<Long> visibilityPositionIds,
        Boolean manageable,
        ru.staffly.restaurant.model.RestaurantRole targetRole
) {
    public TrainingFolderDto(Long id, Long restaurantId, Long parentId, String name, String description,
            TrainingFolderType type, Integer sortOrder, Boolean active, List<Long> visibilityPositionIds, Boolean manageable) {
        this(id, restaurantId, parentId, name, description, type, sortOrder, active, visibilityPositionIds, manageable, null);
    }
}
