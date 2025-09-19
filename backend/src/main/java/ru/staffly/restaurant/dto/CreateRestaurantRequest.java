package ru.staffly.restaurant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateRestaurantRequest(
        @NotBlank @Size(max = 255) String name,
        // если не передадут — сгенерируем из name
        @Size(max = 64) String code
) {}