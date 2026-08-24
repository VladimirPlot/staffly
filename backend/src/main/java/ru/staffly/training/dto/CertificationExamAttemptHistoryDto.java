package ru.staffly.training.dto;

import ru.staffly.training.model.CertificationAssignmentCycleKind;
import ru.staffly.training.model.TrainingExamAssignmentDeactivationReason;
import java.time.Instant;

public record CertificationExamAttemptHistoryDto(
        Long attemptId,
        Long assignmentId,
        Integer assignmentExamVersionSnapshot,
        Long assignmentCycleId,
        Integer assignmentCycleSequence,
        CertificationAssignmentCycleKind assignmentCycleKind,
        Integer resetGeneration,
        TrainingExamAssignmentDeactivationReason deactivationReason,
        Instant startedAt,
        Instant finishedAt,
        Integer scorePercent,
        Boolean passed,
        Integer examVersion,
        int passPercentSnapshot
) {
}
