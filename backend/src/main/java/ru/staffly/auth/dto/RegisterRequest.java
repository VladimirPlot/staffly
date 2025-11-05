package ru.staffly.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank
        @Size(max = 32)
        String phone,

        @NotBlank
        @Email
        @Size(max = 255)
        String email,

        @NotBlank
        @Size(max = 35)
        String firstName,

        @NotBlank
        @Size(max = 35)
        String lastName,

        @NotBlank
        @Size(min = 6, max = 64)
        String password,

        @NotBlank
        @Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$")
        String birthDate
) {}