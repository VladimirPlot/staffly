package ru.staffly.invite.dto;

import ru.staffly.restaurant.model.RestaurantRole;

import java.time.Instant;

public record MyInviteDto(
        String token,
        Long restaurantId,
        String restaurantName,
        RestaurantRole desiredRole,
        Long positionId,
        String positionName,
        Instant expiresAt
) {}