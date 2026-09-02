package ru.staffly.training.dto;

import ru.staffly.training.model.CertificationAssignmentCycleKind;
import ru.staffly.training.model.TrainingExamAssignmentDeactivationReason;
import ru.staffly.training.model.TrainingExamAssignmentStatus;

import java.time.Instant;
import java.util.List;

public record CertificationMyResultDto(
        Long examId,
        String title,
        String description,
        int latestPublishedVersion,
        CurrentObligation currentObligation,
        PreviousValidResult previousValidResult,
        Long unfinishedAttemptId,
        Integer unfinishedAttemptVersion,
        Long unfinishedAssignmentId,
        boolean hasPendingNewerObligation
) {
    public record CurrentObligation(
            Long assignmentId,
            Long specificationId,
            int version,
            Long cycleId,
            Integer cycleSequence,
            CertificationAssignmentCycleKind cycleKind,
            int resetGeneration,
            TrainingExamAssignmentStatus status,
            TrainingExamAssignmentDeactivationReason deactivationReason,
            int attemptsUsed,
            Integer attemptsAllowed,
            Integer bestScore,
            Integer scorePercent,
            int passPercent,
            Instant lastAttemptStartedAt,
            Instant lastAttemptFinishedAt,
            Instant lastAttemptAt,
            Instant passedAt,
            boolean revealCorrectAnswers,
            List<CertificationMyResultQuestionDto> questions
    ) {
    }

    public record PreviousValidResult(
            Long assignmentId,
            Long specificationId,
            int version,
            Long cycleId,
            Integer cycleSequence,
            CertificationAssignmentCycleKind cycleKind,
            int resetGeneration,
            TrainingExamAssignmentDeactivationReason deactivationReason,
            Integer bestScore,
            Integer scorePercent,
            int passPercent,
            Instant passedAt,
            Instant lastAttemptStartedAt,
            Instant lastAttemptFinishedAt,
            boolean revealCorrectAnswers,
            List<CertificationMyResultQuestionDto> questions
    ) {
    }
}
