package ru.staffly.training.dto;

import jakarta.validation.constraints.NotNull;

public record SubmitAttemptAnswerDto(
        @NotNull Long questionId,
        String answerJson
) {}
