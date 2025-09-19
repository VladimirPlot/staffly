package ru.staffly.member.dto;

import ru.staffly.restaurant.model.RestaurantRole;

public record MemberDto(
        Long id,
        Long userId,
        Long restaurantId,
        RestaurantRole role,
        Long positionId,
        String positionName,
        String avatarUrl
) {}