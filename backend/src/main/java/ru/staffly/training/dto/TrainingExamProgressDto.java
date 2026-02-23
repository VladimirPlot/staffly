package ru.staffly.training.dto;

import java.time.Instant;

public record TrainingExamProgressDto(
        Long examId,
        boolean passed,
        Instant lastAttemptAt,
        Integer scorePercent
) {
}