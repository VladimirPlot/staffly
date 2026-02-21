package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingQuestionType;

import java.util.List;

public record TrainingQuestionDto(
        Long id,
        @NotNull Long restaurantId,
        @NotNull Long folderId,
        @NotNull TrainingQuestionType type,
        @NotBlank String prompt,
        String explanation,
        Integer sortOrder,
        Boolean active,
        List<TrainingQuestionOptionDto> options,
        List<TrainingQuestionMatchPairDto> matchPairs
) {}
