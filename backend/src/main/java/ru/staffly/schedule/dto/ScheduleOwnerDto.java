package ru.staffly.schedule.dto;

import ru.staffly.restaurant.model.RestaurantRole;

public record ScheduleOwnerDto(
        Long userId,
        Long memberId,
        String displayName,
        RestaurantRole role,
        String positionName
) {}
