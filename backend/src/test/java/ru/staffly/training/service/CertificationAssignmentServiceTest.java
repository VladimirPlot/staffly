package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CertificationAssignmentServiceTest {
    @Mock
    private TrainingExamAssignmentRepository assignments;
    @Mock
    private TrainingExamAttemptRepository attempts;
    @Mock
    private RestaurantMemberRepository members;

    @InjectMocks
    private CertificationAssignmentService service;

    @Test
    void reopenByGrantingExtraAttemptsMovesExhaustedToAssignedWhenAttemptsRemain() {
        var assignment = TrainingExamAssignment.builder()
                .id(12L)
                .examVersionSnapshot(4)
                .status(TrainingExamAssignmentStatus.EXHAUSTED)
                .attemptsLimitSnapshot(2)
                .attemptsUsed(2)
                .extraAttempts(0)
                .build();

        when(assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(101L, 10L, 501L))
                .thenReturn(Optional.of(assignment));
        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(12L, 4))
                .thenReturn(List.of(finishedAttempt(assignment, Instant.parse("2026-04-16T10:00:00Z"), 75, false),
                        finishedAttempt(assignment, Instant.parse("2026-04-16T10:05:00Z"), 80, false)));

        service.reopenByGrantingExtraAttempts(10L, 101L, 501L, 1);

        assertEquals(1, assignment.getExtraAttempts());
        assertEquals(TrainingExamAssignmentStatus.FAILED, assignment.getStatus());
        assertEquals(2, assignment.getAttemptsUsed());
        assertEquals(80, assignment.getBestScore());
    }

    private TrainingExamAttempt finishedAttempt(TrainingExamAssignment assignment, Instant finishedAt, int score, boolean passed) {
        return TrainingExamAttempt.builder()
                .assignment(assignment)
                .examVersion(assignment.getExamVersionSnapshot())
                .startedAt(finishedAt.minusSeconds(60))
                .finishedAt(finishedAt)
                .scorePercent(score)
                .passed(passed)
                .build();
    }
}
