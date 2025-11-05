package ru.staffly.member.dto;

import ru.staffly.restaurant.model.RestaurantRole;

public record MyMembershipDto(
        Long restaurantId,
        RestaurantRole role
) {}