package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.model.TrainingExamAssignment;
import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.function.Consumer;

@Service
@RequiredArgsConstructor
class CertificationAssignmentLifecycleService {
    private final TrainingExamAttemptRepository attempts;
    private final CertificationAssignmentService assignmentService;

    public TrainingExamAssignment normalizeForStart(TrainingExam exam,
                                                    Long restaurantId,
                                                    Long userId,
                                                    Instant now,
                                                    Consumer<TrainingExamAttempt> expiredAttemptFinalizer) {
        var assignment = assignmentService.resolveForStart(exam, restaurantId, userId);
        return normalize(assignment, now, expiredAttemptFinalizer);
    }

    public TrainingExamAssignment normalize(TrainingExamAssignment assignment,
                                            Instant now,
                                            Consumer<TrainingExamAttempt> expiredAttemptFinalizer) {
        var unfinished = findUnfinishedCurrentAttempt(assignment);
        if (unfinished.isPresent() && isExpiredUnfinishedAttempt(unfinished.get(), now)) {
            expiredAttemptFinalizer.accept(unfinished.get());
            unfinished = findUnfinishedCurrentAttempt(assignment);
        }

        refreshStatus(assignment, unfinished.isPresent());
        return assignment;
    }

    public Optional<TrainingExamAttempt> findUnfinishedCurrentAttempt(TrainingExamAssignment assignment) {
        return attempts.findTopByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
                assignment.getId(),
                assignment.getExamVersionSnapshot()
        );
    }

    private boolean isExpiredUnfinishedAttempt(TrainingExamAttempt attempt, Instant now) {
        if (attempt.getFinishedAt() != null || attempt.getTimeLimitSecSnapshot() == null) {
            return false;
        }
        return attempt.getStartedAt().plusSeconds(attempt.getTimeLimitSecSnapshot()).compareTo(now) <= 0;
    }

    private void refreshStatus(TrainingExamAssignment assignment, boolean hasActiveUnfinishedAttempt) {
        if (assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED) {
            return;
        }
        if (assignment.getPassedAt() != null || assignment.getStatus() == TrainingExamAssignmentStatus.PASSED) {
            assignment.setStatus(TrainingExamAssignmentStatus.PASSED);
            return;
        }
        if (hasActiveUnfinishedAttempt) {
            assignment.setStatus(TrainingExamAssignmentStatus.IN_PROGRESS);
            return;
        }

        Integer attemptsAllowed = assignmentService.calculateAttemptsAllowed(assignment);
        if (attemptsAllowed != null && assignment.getAttemptsUsed() >= attemptsAllowed) {
            assignment.setStatus(TrainingExamAssignmentStatus.EXHAUSTED);
            return;
        }

        assignment.setStatus(assignment.getAttemptsUsed() > 0
                ? TrainingExamAssignmentStatus.FAILED
                : TrainingExamAssignmentStatus.ASSIGNED);
    }
}
