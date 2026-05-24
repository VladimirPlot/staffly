package ru.staffly.training.dto;

import ru.staffly.restaurant.model.RestaurantRole;

public record CertificationOwnerCandidateDto(
        Long userId,
        String fullName,
        RestaurantRole role,
        Long positionId,
        String positionName
) {
}