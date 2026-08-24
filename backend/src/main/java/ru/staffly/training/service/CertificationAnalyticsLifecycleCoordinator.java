package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.model.TrainingExamAttempt;
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
        var currentAssignments = assignments.findCurrentAnalyticsScopeForUpdate(restaurantId, requestedIds);
        var unfinished = attempts.findUnfinishedForCurrentAnalyticsScope(restaurantId, requestedIds);
        var unfinishedByAssignment = unfinished.stream()
                .collect(Collectors.groupingBy(a -> a.getAssignment().getId()));

        for (var assignment : currentAssignments) {
            var candidates = unfinishedByAssignment.getOrDefault(assignment.getId(), List.of());
            normalizeCandidates(assignment.getStatus(), assignment.getPassedAt() != null, candidates, now);
        }

        // Finalization may have changed the canonical set. One batch reload avoids per-assignment
        // reconciliation queries and also repairs stale counters when no unfinished attempt exists.
        entityManager.flush();
        Map<Long, List<TrainingExamAttempt>> finishedByAssignment = attempts
                .findFinishedForCurrentAnalyticsScope(restaurantId, requestedIds).stream()
                .collect(Collectors.groupingBy(a -> a.getAssignment().getId()));
        for (var assignment : currentAssignments) {
            assignmentService.reconcileDerivedStateFromFinishedAttempts(
                    assignment, finishedByAssignment.getOrDefault(assignment.getId(), List.of()));
            boolean hasLiveUnfinished = unfinishedByAssignment.getOrDefault(assignment.getId(), List.of()).stream()
                    .anyMatch(attempt -> attempt.getFinishedAt() == null);
            assignmentService.refreshStatus(assignment, hasLiveUnfinished);
        }
    }

    private void normalizeCandidates(TrainingExamAssignmentStatus status,
                                     boolean hasPassedAt,
                                     List<TrainingExamAttempt> candidates,
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
        if (status == TrainingExamAssignmentStatus.PASSED || hasPassedAt) {
            finalizer.finalizeStaleUnfinishedAttemptForLifecycleRepair(current, now);
        } else if (isExpired(current, now)) {
            finalizer.finalizeExpiredUnfinishedAttempt(current, now);
        }
    }

    private boolean isExpired(TrainingExamAttempt attempt, Instant now) {
        return attempt.getTimeLimitSecSnapshot() != null
                && attempt.getStartedAt().plusSeconds(attempt.getTimeLimitSecSnapshot()).compareTo(now) <= 0;
    }
}
