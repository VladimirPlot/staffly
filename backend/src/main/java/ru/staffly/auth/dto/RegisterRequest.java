package ru.staffly.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record RegisterRequest(
        @NotBlank String phone,
        String email,
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank String password
) {}