package ru.staffly.training.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingExamMode;

import java.util.List;

public record TrainingExamDto(
        Long id,
        @NotNull Long restaurantId,
        @NotBlank String title,
        String description,
        @NotNull @Min(1) Integer questionCount,
        @NotNull @Min(1) @Max(100) Integer passPercent,
        Integer timeLimitSec,
        @NotNull TrainingExamMode mode,
        Long knowledgeFolderId,
        Integer attemptLimit,
        Integer version,
        Boolean active,
        List<ExamSourceFolderDto> sourcesFolders,
        List<Long> sourceQuestionIds,
        List<Long> visibilityPositionIds
) {}
