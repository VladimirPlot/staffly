package ru.staffly.dictionary.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.staffly.restaurant.model.RestaurantRole;

public record PositionDto(
        Long id,
        @NotNull Long restaurantId,
        @NotBlank @Size(max = 100) String name,
        Boolean active,
        RestaurantRole level
) {}