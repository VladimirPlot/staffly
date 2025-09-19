package ru.staffly.member.dto;

import jakarta.validation.constraints.NotNull;
import ru.staffly.restaurant.model.RestaurantRole;

public record UpdateMemberRoleRequest(
        @NotNull RestaurantRole role
) {}