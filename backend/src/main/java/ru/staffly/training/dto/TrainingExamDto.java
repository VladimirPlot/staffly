package ru.staffly.training.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record TrainingExamDto(
        Long id,
        @NotNull Long restaurantId,
        @NotBlank String title,
        String description,
        @NotNull Integer questionCount,
        @NotNull Integer passPercent,
        Integer timeLimitSec,
        Boolean active,
        List<Long> folderIds
) {}
