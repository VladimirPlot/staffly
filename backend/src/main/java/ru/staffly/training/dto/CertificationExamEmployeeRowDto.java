package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamAssignmentStatus;

import java.time.Instant;

public record CertificationExamEmployeeRowDto(
        Long assignmentId,
        Long userId,
        String fullName,
        Long assignedPositionId,
        String assignedPositionName,
        Long currentPositionId,
        String currentPositionName,
        TrainingExamAssignmentStatus status,
        int attemptsUsed,
        Integer attemptsAllowed,
        int extraAttempts,
        Integer bestScore,
        Instant lastAttemptAt,
        Instant passedAt
) {
}