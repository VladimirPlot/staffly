package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.model.TrainingExamAssignmentDeactivationReason;
import ru.staffly.training.model.CertificationAssignmentCycleKind;

import java.time.Instant;
import java.util.List;

public record CertificationMyResultDto(
        Long examId,
        String title,
        String description,
        int latestPublishedVersion,
        boolean certified,
        Long currentAssignmentId,
        Integer currentAssignmentVersion,
        Long currentAssignmentCycleId,
        Integer currentAssignmentCycleSequence,
        CertificationAssignmentCycleKind currentAssignmentCycleKind,
        Integer currentAssignmentResetGeneration,
        TrainingExamAssignmentStatus currentAssignmentStatus,
        TrainingExamAssignmentDeactivationReason currentAssignmentDeactivationReason,
        Long validResultAssignmentId,
        Integer validResultVersion,
        Long validResultCycleId,
        Instant validResultPassedAt,
        Integer validResultScorePercent,
        TrainingExamAssignmentDeactivationReason validResultDeactivationReason,
        Long unfinishedAttemptId,
        Integer unfinishedAttemptVersion,
        Long unfinishedAssignmentId,
        boolean hasPendingNewerObligation,
        /** Selected completed/result assignment fields; never describe the current obligation implicitly. */
        Integer scorePercent,
        int passPercent,
        /** Current active obligation allowance fields (or selected result fallback when no active obligation exists). */
        int attemptsUsed,
        Integer attemptsAllowed,
        boolean revealCorrectAnswers,
        Integer bestScore,
        Instant lastAttemptStartedAt,
        Instant lastAttemptFinishedAt,
        @Deprecated
        Instant lastAttemptAt,
        Instant passedAt,
        List<CertificationMyResultQuestionDto> questions
) {
}
