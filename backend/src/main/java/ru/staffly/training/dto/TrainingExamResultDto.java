package ru.staffly.training.dto;

import java.time.Instant;

public record TrainingExamResultDto(
        Long userId,
        String fullName,
        int attemptsUsed,
        Integer bestScore,
        Instant lastAttemptAt,
        boolean passed
) {}
