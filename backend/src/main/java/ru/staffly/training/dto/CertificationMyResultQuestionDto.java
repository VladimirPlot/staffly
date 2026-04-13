package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingQuestionType;

public record CertificationMyResultQuestionDto(
        Long questionId,
        TrainingQuestionType questionType,
        String prompt,
        String chosenAnswerJson,
        boolean correct,
        String correctAnswerJson,
        String explanation
) {
}