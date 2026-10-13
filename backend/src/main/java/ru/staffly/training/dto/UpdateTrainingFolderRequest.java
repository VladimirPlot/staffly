package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateTrainingFolderRequest(
        @NotBlank @Size(max = 150) String name,
        String description,
        Integer sortOrder,
        List<Long> visibilityPositionIds,
        ru.staffly.restaurant.model.RestaurantRole targetRole
) {
    public UpdateTrainingFolderRequest(String name, String description, Integer sortOrder, List<Long> visibilityPositionIds) {
        this(name, description, sortOrder, visibilityPositionIds, null);
    }
}
