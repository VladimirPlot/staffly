package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingQuestionType;

import java.util.List;

public record CreateTrainingQuestionRequest(
        @NotNull Long folderId,
        @NotNull TrainingQuestionType type,
        @NotBlank String prompt,
        String explanation,
        Integer sortOrder,
        List<TrainingQuestionOptionDto> options,
        List<TrainingQuestionMatchPairDto> matchPairs
) {}
