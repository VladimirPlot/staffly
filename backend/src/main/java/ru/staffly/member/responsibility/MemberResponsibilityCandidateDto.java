package ru.staffly.member.responsibility;

import ru.staffly.restaurant.model.RestaurantRole;

public record MemberResponsibilityCandidateDto(
        Long userId,
        Long memberId,
        String displayName,
        RestaurantRole role,
        Long positionId,
        String positionName
) {
}
