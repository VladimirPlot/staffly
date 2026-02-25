package ru.staffly.training.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingExamMode;

import java.util.List;

public record TrainingExamDto(
        Long id,
        Long restaurantId,
        @NotBlank String title,
        String description,
        @NotNull @Min(1) Integer questionCount,
        @NotNull @Min(1) @Max(100) Integer passPercent,
        @Min(0) Integer timeLimitSec,
        @NotNull TrainingExamMode mode,
        @Min(1) Integer attemptLimit,
        @NotNull @Min(1) Integer version,
        Boolean active,
        List<Long> folderIds,
        List<Long> visibilityPositionIds
) {}
