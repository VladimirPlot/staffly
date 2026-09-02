package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingQuestionType;

public record CertificationMyResultQuestionDto(
        Long questionId,
        TrainingQuestionType questionType,
        String prompt,
        String chosenAnswerJson,
        Boolean correct,
        String correctAnswerJson,
        String explanation
) {
}
