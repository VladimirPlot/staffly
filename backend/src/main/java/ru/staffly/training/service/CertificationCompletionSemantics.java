package ru.staffly.training.service;

import ru.staffly.training.model.TrainingExamAssignment;
import ru.staffly.training.model.TrainingExamAssignmentStatus;

import java.util.List;

/** Shared business meaning of a completed Certification obligation. */
final class CertificationCompletionSemantics {
    static final String SUPERSEDED_ATTEMPT_MESSAGE =
            "Во время вашего прохождения тест был обновлён. Результат этой попытки сохранён, "
                    + "но для текущей аттестации необходимо пройти новую версию теста.";

    private static final List<TrainingExamAssignmentStatus> COMPLETED_STATUSES = List.of(
            TrainingExamAssignmentStatus.PASSED,
            TrainingExamAssignmentStatus.EXHAUSTED
    );

    private CertificationCompletionSemantics() {
    }

    static boolean isCompleted(TrainingExamAssignment assignment) {
        return assignment != null && (assignment.getPassedAt() != null
                || COMPLETED_STATUSES.contains(assignment.getStatus()));
    }

    static List<TrainingExamAssignmentStatus> completedStatuses() {
        return COMPLETED_STATUSES;
    }
}
