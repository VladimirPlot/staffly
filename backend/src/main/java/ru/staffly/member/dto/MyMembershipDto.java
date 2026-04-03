package ru.staffly.member.dto;

import ru.staffly.dictionary.model.PositionSpecialization;
import ru.staffly.restaurant.model.RestaurantRole;

import java.util.Set;

public record MyMembershipDto(
        Long restaurantId,
        String restaurantName,
        String restaurantDescription,
        String restaurantTimezone,
        boolean restaurantLocked,
        RestaurantRole role,
        Set<PositionSpecialization> specializations
) {}
