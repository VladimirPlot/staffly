package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.model.TrainingExamAssignment;
import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
class CertificationAssignmentLifecycleService {
    private final TrainingExamAttemptRepository attempts;
    private final CertificationAssignmentService assignmentService;
    private final CertificationExpiredAttemptFinalizer expiredAttemptFinalizer;

    public TrainingExamAssignment normalizeForStart(TrainingExam exam,
                                                    Long restaurantId,
                                                    Long userId,
                                                    Instant now) {
        var assignment = assignmentService.resolveForStart(exam, restaurantId, userId);
        return normalize(assignment, now);
    }

    public TrainingExamAssignment normalize(TrainingExamAssignment assignment, Instant now) {
        // Full lifecycle normalization for certification assignment.
        // This is intentionally allowed to mutate DB state (read-repair) by:
        // 1) force-finalizing stale unfinished attempts,
        // 2) finalizing expired current unfinished attempt,
        // 3) reconciling persisted derived fields from finished attempts,
        // 4) recomputing assignment status from canonical data.
        var unfinishedAttempts = findUnfinishedCurrentAttempts(assignment);
        if (unfinishedAttempts.size() > 1) {
            log.warn("Found {} active unfinished certification attempts for assignmentId={} examVersion={}. " +
                            "Keeping latest, force-finalizing stale duplicates for lifecycle repair.",
                    unfinishedAttempts.size(), assignment.getId(), assignment.getExamVersionSnapshot());
            for (int i = 1; i < unfinishedAttempts.size(); i++) {
                expiredAttemptFinalizer.finalizeExpiredAttempt(unfinishedAttempts.get(i), now);
            }
            unfinishedAttempts = findUnfinishedCurrentAttempts(assignment);
        }

        Optional<TrainingExamAttempt> unfinished = unfinishedAttempts.stream().findFirst();
        if (unfinished.isPresent() && (assignment.getPassedAt() != null || assignment.getStatus() == TrainingExamAssignmentStatus.PASSED)) {
            expiredAttemptFinalizer.finalizeExpiredAttempt(unfinished.get(), now);
            unfinished = Optional.empty();
        }
        if (unfinished.isPresent() && isExpiredUnfinishedAttempt(unfinished.get(), now)) {
            expiredAttemptFinalizer.finalizeExpiredAttempt(unfinished.get(), now);
            unfinished = Optional.empty();
        }

        assignmentService.reconcileDerivedStateFromFinishedAttempts(assignment);
        assignmentService.refreshStatus(assignment, unfinished.isPresent());
        return assignment;
    }

    public Optional<TrainingExamAttempt> findUnfinishedCurrentAttempt(TrainingExamAssignment assignment) {
        return findUnfinishedCurrentAttempts(assignment).stream().findFirst();
    }

    private List<TrainingExamAttempt> findUnfinishedCurrentAttempts(TrainingExamAssignment assignment) {
        return attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
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
}
