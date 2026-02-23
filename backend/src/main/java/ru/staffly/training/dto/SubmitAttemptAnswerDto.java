package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SubmitAttemptAnswerDto(
        @NotNull Long questionId,
        @NotBlank String answerJson
) {}
