package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingQuestionGroup;
import ru.staffly.training.model.TrainingQuestionType;

import java.util.List;

public record TrainingQuestionDto(
        Long id,
        Long restaurantId,
        Long folderId,
        TrainingQuestionType type,
        TrainingQuestionGroup questionGroup,
        String title,
        String prompt,
        String explanation,
        Integer sortOrder,
        Boolean active,
        List<TrainingQuestionOptionDto> options,
        List<TrainingQuestionMatchPairDto> matchPairs,
        List<TrainingQuestionBlankDto> blanks
) {}
