package ru.staffly.anonymousletter.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AnonymousLetterRequest(
        @NotBlank @Size(max = 50) String subject,
        @NotNull Long recipientMemberId,
        @NotBlank String content
) {}