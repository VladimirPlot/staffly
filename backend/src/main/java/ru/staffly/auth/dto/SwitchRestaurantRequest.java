package ru.staffly.auth.dto;

import jakarta.validation.constraints.NotNull;

public record SwitchRestaurantRequest(@NotNull Long restaurantId) {
}
