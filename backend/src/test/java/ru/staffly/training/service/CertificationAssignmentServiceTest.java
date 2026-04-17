package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
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

    @Test
    void fullResetEmployeeAttemptsArchivesCurrentAndCreatesCleanActiveAssignment() {
        var exam = TrainingExam.builder()
                .id(101L)
                .attemptLimit(1)
                .version(7)
                .build();
        var restaurant = Restaurant.builder().id(10L).build();
        var user = User.builder().id(501L).build();
        var oldAssignment = TrainingExamAssignment.builder()
                .id(12L)
                .exam(exam)
                .restaurant(restaurant)
                .user(user)
                .examVersionSnapshot(4)
                .attemptsUsed(4)
                .extraAttempts(3)
                .bestScore(80)
                .status(TrainingExamAssignmentStatus.EXHAUSTED)
                .active(true)
                .build();
        var member = ru.staffly.member.model.RestaurantMember.builder()
                .position(ru.staffly.dictionary.model.Position.builder().id(33L).build())
                .build();

        when(assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(101L, 10L, 501L))
                .thenReturn(Optional.of(oldAssignment));
        when(members.findByUserIdAndRestaurantIdWithPosition(501L, 10L)).thenReturn(Optional.of(member));
        when(assignments.save(any(TrainingExamAssignment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0, TrainingExamAssignment.class));

        service.fullResetEmployeeAttempts(10L, 101L, 501L);

        assertFalse(oldAssignment.isActive());
        assertEquals(TrainingExamAssignmentStatus.ARCHIVED, oldAssignment.getStatus());

        var captor = org.mockito.ArgumentCaptor.forClass(TrainingExamAssignment.class);
        verify(assignments).save(captor.capture());
        var created = captor.getValue();
        assertTrue(created.isActive());
        assertEquals(TrainingExamAssignmentStatus.ASSIGNED, created.getStatus());
        assertEquals(0, created.getAttemptsUsed());
        assertEquals(0, created.getExtraAttempts());
        assertNull(created.getBestScore());
        assertNull(created.getLastAttemptAt());
        assertNull(created.getPassedAt());
        assertEquals(7, created.getExamVersionSnapshot());
        assertEquals(1, created.getAttemptsLimitSnapshot());
        assertEquals(33L, created.getAssignedPosition().getId());
        assertEquals(oldAssignment.getExam(), created.getExam());
        assertEquals(oldAssignment.getRestaurant(), created.getRestaurant());
        assertEquals(oldAssignment.getUser(), created.getUser());
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
