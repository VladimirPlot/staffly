package ru.staffly.invite.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.staffly.restaurant.model.RestaurantRole;

public record InviteRequest(
        @NotBlank @Size(max = 255) String phoneOrEmail,
        @NotNull RestaurantRole role,
        Long positionId // optional
) {}