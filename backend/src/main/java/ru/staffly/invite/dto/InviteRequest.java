package ru.staffly.invite.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InviteRequest(
        @NotBlank @Size(max = 255) String phoneOrEmail
) {}