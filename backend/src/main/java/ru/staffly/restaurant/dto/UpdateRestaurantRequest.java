package ru.staffly.restaurant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateRestaurantRequest(
        @NotBlank @Size(max = 255) String name,
        @Size(max = 500) String description,
        @NotBlank @Size(max = 64) String timezone
) {}