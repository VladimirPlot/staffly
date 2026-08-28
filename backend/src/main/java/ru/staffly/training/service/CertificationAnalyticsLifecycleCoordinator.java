package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** Orchestrates read-repair at the current Certification analytics boundary. */
@Service
@RequiredArgsConstructor
@Slf4j
class CertificationAnalyticsLifecycleCoordinator {
    private final TrainingExamAssignmentRepository assignments;
    private final TrainingExamAttemptRepository attempts;
    private final CertificationAttemptFinalizationService finalizer;
    private final CertificationAssignmentService assignmentService;
    private final EntityManager entityManager;

    public void normalizeCurrentExam(Long restaurantId, Long examId, Instant now) {
        normalizeCurrentExams(restaurantId, List.of(examId), now);
    }

    public void normalizeCurrentExams(Long restaurantId, Collection<Long> examIds, Instant now) {
        var requestedIds = examIds.stream().filter(Objects::nonNull).distinct().toList();
        if (requestedIds.isEmpty()) {
            return;
        }

        // Assignment-first locking matches start and the common finalizer. Locking the complete
        // requested scope also makes reconciliation of assignments with no unfinished attempt safe.
        var currentAssignments = assignments.findActiveCertificationObligationsForAnalyticsUpdate(restaurantId, requestedIds);
        var unfinished = attempts.findUnfinishedForActiveObligationsAnalyticsScope(restaurantId, requestedIds);
        var unfinishedByAssignment = unfinished.stream()
                .collect(Collectors.groupingBy(a -> a.getAssignment().getId()));

        // PASSED is canonical only when reconciliation finds a finished passing attempt.
        // Do not use a stale persisted status to decide that an unfinished attempt is stale.
        Map<Long, List<TrainingExamAttempt>> finishedByAssignment = attempts
                .findFinishedForActiveObligationsAnalyticsScope(restaurantId, requestedIds).stream()
                .collect(Collectors.groupingBy(a -> a.getAssignment().getId()));

        for (var assignment : currentAssignments) {
            validateActiveObligationIdentity(assignment);
            assignmentService.reconcileDerivedStateFromFinishedAttempts(
                    assignment, finishedByAssignment.getOrDefault(assignment.getId(), List.of()));
            var candidates = unfinishedByAssignment.getOrDefault(assignment.getId(), List.of());
            normalizeCandidates(candidates, now);
        }

        // Finalization may have changed the canonical set. One batch reload avoids per-assignment
        // reconciliation queries and also repairs stale counters when no unfinished attempt exists.
        entityManager.flush();
        finishedByAssignment = attempts
                .findFinishedForActiveObligationsAnalyticsScope(restaurantId, requestedIds).stream()
                .collect(Collectors.groupingBy(a -> a.getAssignment().getId()));
        for (var assignment : currentAssignments) {
            assignmentService.reconcileDerivedStateFromFinishedAttempts(
                    assignment, finishedByAssignment.getOrDefault(assignment.getId(), List.of()));
            boolean hasLiveUnfinished = unfinishedByAssignment.getOrDefault(assignment.getId(), List.of()).stream()
                    .anyMatch(attempt -> attempt.getFinishedAt() == null);
            assignmentService.refreshStatus(assignment, hasLiveUnfinished);
        }
    }

    private void validateActiveObligationIdentity(ru.staffly.training.model.TrainingExamAssignment assignment) {
        var specification = assignment.getAssessmentSpecification();
        var cycle = assignment.getAssignmentCycle();
        if (assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED
                || specification == null
                || !Objects.equals(specification.getExam().getId(), assignment.getExam().getId())
                || specification.getVersion() != assignment.getExamVersionSnapshot()
                || cycle != null && (!Objects.equals(cycle.getExam().getId(), assignment.getExam().getId())
                || !Objects.equals(cycle.getAssessmentSpecification().getId(), specification.getId()))) {
            throw new IllegalStateException("Active Certification obligation identity is inconsistent: assignmentId="
                    + assignment.getId());
        }
    }

    private void normalizeCandidates(List<TrainingExamAttempt> candidates,
                                     Instant now) {
        if (candidates.size() > 1) {
            log.warn("Found {} unfinished attempts for current assignmentId={}; repairing older duplicates",
                    candidates.size(), candidates.get(0).getAssignment().getId());
            for (int i = 1; i < candidates.size(); i++) {
                finalizer.finalizeStaleUnfinishedAttemptForLifecycleRepair(candidates.get(i), now);
            }
        }
        if (candidates.isEmpty()) {
            return;
        }
        var current = candidates.get(0);
        if (isExpired(current, now)) {
            finalizer.finalizeExpiredUnfinishedAttempt(current, now);
        }
    }

    private boolean isExpired(TrainingExamAttempt attempt, Instant now) {
        return attempt.getTimeLimitSecSnapshot() != null
                && attempt.getStartedAt().plusSeconds(attempt.getTimeLimitSecSnapshot()).compareTo(now) <= 0;
    }
}
