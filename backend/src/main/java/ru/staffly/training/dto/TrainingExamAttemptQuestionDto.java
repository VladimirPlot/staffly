package ru.staffly.training.dto;

public record TrainingExamAttemptQuestionDto(
        Long id,
        Long questionId,
        String chosenAnswerJson,
        Boolean correct
) {}
