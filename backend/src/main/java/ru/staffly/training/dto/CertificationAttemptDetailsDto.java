package ru.staffly.training.dto;

import ru.staffly.training.model.CertificationAssignmentCycleKind;
import ru.staffly.training.model.TrainingExamAssignmentDeactivationReason;
import java.time.Instant;
import java.util.List;

public record CertificationAttemptDetailsDto(
        Long attemptId,
        Long examId,
        String examTitle,
        Long userId,
        String userFullName,
        Long assignmentId,
        Integer examVersion,
        Long assignmentCycleId,
        Integer assignmentCycleSequence,
        CertificationAssignmentCycleKind assignmentCycleKind,
        Integer resetGeneration,
        TrainingExamAssignmentDeactivationReason deactivationReason,
        Instant startedAt,
        Instant finishedAt,
        Integer scorePercent,
        int passPercent,
        boolean passed,
        Integer questionCount,
        Long durationSec,
        List<CertificationAttemptDetailsQuestionDto> questions
) {
}
