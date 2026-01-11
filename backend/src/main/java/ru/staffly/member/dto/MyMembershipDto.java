package ru.staffly.member.dto;

import ru.staffly.restaurant.model.RestaurantRole;

public record MyMembershipDto(
        Long restaurantId,
        String restaurantName,
        String restaurantDescription,
        String restaurantTimezone,
        boolean restaurantLocked,
        RestaurantRole role
) {}