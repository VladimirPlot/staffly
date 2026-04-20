package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingQuestionType;

public record CertificationAttemptDetailsQuestionDto(
        Long questionId,
        TrainingQuestionType questionType,
        String prompt,
        String chosenAnswerJson,
        boolean correct,
        String correctAnswerJson,
        String explanation
) {
}
