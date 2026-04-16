package ru.staffly.training.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAttemptRepository;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CertificationAssignmentLifecycleServiceTest {

    @Mock
    private TrainingExamAttemptRepository attempts;
    @Mock
    private CertificationAssignmentService assignmentService;
    @Mock
    private CertificationExpiredAttemptFinalizer expiredAttemptFinalizer;

    private CertificationAssignmentLifecycleService lifecycleService;

    @BeforeEach
    void setUp() {
        lifecycleService = new CertificationAssignmentLifecycleService(attempts, assignmentService, expiredAttemptFinalizer);
    }

    @Test
    void normalizeFinalizesExpiredAttemptAndMarksExhaustedWhenLimitReached() {
        var assignment = assignment(2, 2, 0, TrainingExamAssignmentStatus.IN_PROGRESS);
        var expiredAttempt = unfinishedAttempt(assignment, Instant.parse("2026-04-16T10:00:00Z"), 60);

        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(assignment.getId(), 3))
                .thenReturn(List.of(expiredAttempt));

        lifecycleService.normalize(assignment, Instant.parse("2026-04-16T10:10:00Z"));

        verify(expiredAttemptFinalizer).finalizeExpiredAttempt(eq(expiredAttempt), eq(Instant.parse("2026-04-16T10:10:00Z")));
        verify(assignmentService).reconcileDerivedStateFromFinishedAttempts(assignment);
        verify(assignmentService).refreshStatus(assignment, false);
    }

    @Test
    void normalizeKeepsValidUnfinishedAttemptAndMarksInProgress() {
        var assignment = assignment(10, 1, 0, TrainingExamAssignmentStatus.ASSIGNED);
        var activeAttempt = unfinishedAttempt(assignment, Instant.parse("2026-04-16T10:00:00Z"), 3600);

        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(assignment.getId(), 3))
                .thenReturn(List.of(activeAttempt));

        lifecycleService.normalize(assignment, Instant.parse("2026-04-16T10:10:00Z"));

        verify(expiredAttemptFinalizer, never()).finalizeExpiredAttempt(any(), any());
        verify(assignmentService).reconcileDerivedStateFromFinishedAttempts(assignment);
        verify(assignmentService).refreshStatus(assignment, true);
    }

    @Test
    void normalizeReopensExhaustedAssignmentWhenExtraAttemptsGranted() {
        var assignment = assignment(1, 1, 1, TrainingExamAssignmentStatus.EXHAUSTED);

        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(assignment.getId(), 3))
                .thenReturn(List.of());

        lifecycleService.normalize(assignment, Instant.parse("2026-04-16T10:10:00Z"));

        verify(assignmentService).refreshStatus(assignment, false);
    }

    @Test
    void normalizeKeepsPassedAssignmentPassed() {
        var assignment = assignment(3, 1, 0, TrainingExamAssignmentStatus.PASSED);
        assignment.setPassedAt(Instant.parse("2026-04-16T09:00:00Z"));

        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(assignment.getId(), 3))
                .thenReturn(List.of());

        lifecycleService.normalize(assignment, Instant.parse("2026-04-16T10:10:00Z"));

        verify(assignmentService).refreshStatus(assignment, false);
    }

    @Test
    void normalizeTreatsZeroTimeLimitAsImmediatelyExpired() {
        var assignment = assignment(1, 0, 0, TrainingExamAssignmentStatus.IN_PROGRESS);
        var zeroLimitAttempt = unfinishedAttempt(assignment, Instant.parse("2026-04-16T10:00:00Z"), 0);

        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(assignment.getId(), 3))
                .thenReturn(List.of(zeroLimitAttempt));

        lifecycleService.normalize(assignment, Instant.parse("2026-04-16T10:00:00Z"));

        verify(expiredAttemptFinalizer).finalizeExpiredAttempt(eq(zeroLimitAttempt), eq(Instant.parse("2026-04-16T10:00:00Z")));
    }

    @Test
    void normalizeFinalizesDuplicateUnfinishedAttemptsAndKeepsNewestAsActive() {
        var assignment = assignment(3, 1, 0, TrainingExamAssignmentStatus.IN_PROGRESS);
        var latest = unfinishedAttempt(assignment, Instant.parse("2026-04-16T10:09:00Z"), 3600);
        var staleDuplicate = unfinishedAttempt(assignment, Instant.parse("2026-04-16T10:00:00Z"), 3600);
        staleDuplicate.setId(78L);

        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(assignment.getId(), 3))
                .thenReturn(List.of(latest, staleDuplicate), List.of(latest));

        lifecycleService.normalize(assignment, Instant.parse("2026-04-16T10:10:00Z"));

        verify(expiredAttemptFinalizer).finalizeExpiredAttempt(eq(staleDuplicate), eq(Instant.parse("2026-04-16T10:10:00Z")));
        verify(assignmentService).refreshStatus(assignment, true);
    }

    private TrainingExamAssignment assignment(int allowed, int used, int extra, TrainingExamAssignmentStatus status) {
        var exam = TrainingExam.builder().id(21L).version(3).mode(TrainingExamMode.CERTIFICATION).build();
        return TrainingExamAssignment.builder()
                .id(11L)
                .exam(exam)
                .restaurant(Restaurant.builder().id(1L).build())
                .user(User.builder().id(42L).build())
                .examVersionSnapshot(3)
                .attemptsLimitSnapshot(allowed)
                .attemptsUsed(used)
                .extraAttempts(extra)
                .status(status)
                .build();
    }

    private TrainingExamAttempt unfinishedAttempt(TrainingExamAssignment assignment, Instant startedAt, Integer timeLimitSec) {
        return TrainingExamAttempt.builder()
                .id(77L)
                .assignment(assignment)
                .exam(assignment.getExam())
                .examVersion(assignment.getExamVersionSnapshot())
                .restaurant(assignment.getRestaurant())
                .user(assignment.getUser())
                .startedAt(startedAt)
                .timeLimitSecSnapshot(timeLimitSec)
                .build();
    }
}
