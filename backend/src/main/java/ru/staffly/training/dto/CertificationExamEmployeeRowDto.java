package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.model.TrainingExamAssignmentDeactivationReason;
import ru.staffly.training.model.CertificationAssignmentCycleKind;

import java.time.Instant;

public record CertificationExamEmployeeRowDto(
        Long assignmentId,
        Integer assignmentVersion,
        Integer latestPublishedVersion,
        Long assignmentCycleId,
        Integer assignmentCycleSequence,
        CertificationAssignmentCycleKind assignmentCycleKind,
        Integer resetGeneration,
        TrainingExamAssignmentDeactivationReason deactivationReason,
        Long userId,
        String fullName,
        Long assignedPositionId,
        String assignedPositionName,
        Long currentPositionId,
        String currentPositionName,
        TrainingExamAssignmentStatus status,
        CertificationAnalyticsStatus analyticsStatus,
        int attemptsUsed,
        Integer attemptsAllowed,
        int extraAttempts,
        Integer bestScore,
        Instant lastAttemptAt,
        Instant passedAt
) {
}
