package ru.staffly.training.dto;

public record TrainingQuestionMatchPairViewDto(
        Integer sortOrder,
        String leftText,
        String rightText
) {}
