package ru.staffly.training.dto;

import java.util.List;

public record TrainingQuestionBlankViewDto(
        Integer blankIndex,
        List<TrainingQuestionBlankOptionViewDto> options
) {}