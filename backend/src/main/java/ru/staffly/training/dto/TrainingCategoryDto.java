package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.staffly.training.model.TrainingModule;

import java.util.List;

public record TrainingCategoryDto(
        Long id,
        Long restaurantId,
        TrainingModule module,
        @Size(max = 150) String name,
        String description,
        Integer sortOrder,
        Boolean active,
        // список id позиций, которым видна категория
        List<Long> visiblePositionIds
) {}