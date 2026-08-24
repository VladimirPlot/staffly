package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.model.CertificationAssignmentCycleKind;

import java.time.Instant;

public record CurrentUserCertificationExamDto(
        Long examId,
        String title,
        String description,
        Integer questionCount,
        Integer passPercent,
        Integer timeLimitSec,
        Integer baseAttemptLimit,
        Boolean active,
        Long assignmentId,
        TrainingExamAssignmentStatus assignmentStatus,
        Instant assignedAt,
        Integer examVersionSnapshot,
        Integer latestPublishedVersion,
        Long assignmentCycleId,
        Integer assignmentCycleSequence,
        CertificationAssignmentCycleKind assignmentCycleKind,
        Integer resetGeneration,
        Integer attemptsUsed,
        Integer attemptsAllowed,
        Integer extraAttempts,
        Integer bestScore,
        Instant lastAttemptAt,
        Instant passedAt
) {
}
