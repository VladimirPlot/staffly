package ru.staffly.announcement.dto;

import ru.staffly.restaurant.model.RestaurantRole;

public record AnnouncementPositionDto(
        Long id,
        String name,
        boolean active,
        RestaurantRole level
) {
}