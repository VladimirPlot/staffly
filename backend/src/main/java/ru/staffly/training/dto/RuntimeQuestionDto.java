package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingQuestionType;

import java.util.List;

public record RuntimeQuestionDto(
        Long questionId,
        TrainingQuestionType type,
        String prompt,
        String explanation,
        List<TrainingQuestionOptionViewDto> options,
        List<RuntimeQuestionItemDto> matchLeftItems,
        List<RuntimeQuestionItemDto> matchRightOptions,
        List<TrainingQuestionBlankViewDto> blanks
) {}
