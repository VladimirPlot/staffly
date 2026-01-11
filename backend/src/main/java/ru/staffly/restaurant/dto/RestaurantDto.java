package ru.staffly.restaurant.dto;

import ru.staffly.restaurant.model.Restaurant;

public record RestaurantDto(
        Long id,
        String name,
        String code,
        String description,
        String timezone,
        boolean active,
        boolean locked
) {
    public static RestaurantDto from(Restaurant restaurant) {
        return new RestaurantDto(
                restaurant.getId(),
                restaurant.getName(),
                restaurant.getCode(),
                restaurant.getDescription(),
                restaurant.getTimezone(),
                restaurant.isActive(),
                restaurant.isLocked()
        );
    }
}