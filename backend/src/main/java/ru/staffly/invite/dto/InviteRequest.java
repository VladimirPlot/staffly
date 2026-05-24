package ru.staffly.invite.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record InviteRequest(
        @NotBlank @Size(max = 32) String phone,
        @NotNull Long positionId
) {}
