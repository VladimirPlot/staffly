package ru.staffly.training.dto;

public record AttemptResultQuestionDto(
        Long questionId,
        String chosenAnswerJson,
        Boolean correct
) {}
