package ru.staffly.training.dto;

public record TrainingQuestionBlankOptionDto(
        Long id,
        String text,
        Boolean correct,
        Integer sortOrder
) {}