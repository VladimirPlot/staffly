package ru.staffly.member.dto;

import ru.staffly.restaurant.model.RestaurantRole;

import java.time.LocalDate;

public record MemberDto(
        Long id,
        Long userId,
        Long restaurantId,
        RestaurantRole role,
        Long positionId,
        String positionName,
        String avatarUrl,
        String phone,
        String firstName,
        String lastName,
        String fullName,
        LocalDate birthDate
) {}