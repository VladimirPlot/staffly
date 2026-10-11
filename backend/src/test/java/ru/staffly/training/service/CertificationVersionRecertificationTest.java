package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CertificationVersionRecertificationTest {
    final TrainingExamAssignmentRepository assignments = mock(TrainingExamAssignmentRepository.class);
    final TrainingExamAttemptRepository attempts = mock(TrainingExamAttemptRepository.class);
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final CertificationAssignmentCycleRepository cycles = mock(CertificationAssignmentCycleRepository.class);
    final CertificationAssignmentService service = new CertificationAssignmentService(assignments, attempts, members,
            mock(CertificationAssessmentSpecificationService.class), cycles, mock(EntityManager.class));
    final Position position = Position.builder().id(4L).build();
    final TrainingExam exam = TrainingExam.builder().id(1L).restaurant(Restaurant.builder().id(2L).build())
            .mode(TrainingExamMode.CERTIFICATION).active(true).version(2).visibilityPositions(Set.of(position)).build();
    final CertificationAssessmentSpecification oldSpecification = CertificationAssessmentSpecification.builder()
            .id(10L).exam(exam).version(1).build();
    final CertificationAssessmentSpecification newSpecification = CertificationAssessmentSpecification.builder()
            .id(11L).exam(exam).version(2).build();
    final CertificationAssignmentCycle previous = CertificationAssignmentCycle.builder().id(20L).exam(exam)
            .assessmentSpecification(oldSpecification).cycleSequence(1).build();
    final CertificationAssignmentCycle current = CertificationAssignmentCycle.builder().id(21L).exam(exam)
            .assessmentSpecification(newSpecification).cycleSequence(2).build();
    final User user = User.builder().id(5L).build();
    final TrainingExamAssignment old = TrainingExamAssignment.builder().id(30L).exam(exam).restaurant(exam.getRestaurant())
            .user(user).assessmentSpecification(oldSpecification).assignmentCycle(previous).examVersionSnapshot(1)
            .status(TrainingExamAssignmentStatus.ASSIGNED).active(true).build();

    void setup() {
        when(members.findActiveWithUserAndPositionByRestaurantId(2L)).thenReturn(List.of(RestaurantMember.builder()
                .user(user).position(position).build()));
        when(assignments.findLifecyclePredecessorCandidatesForRecertification(1L, 2L)).thenReturn(List.of(old));
        when(cycles.findTopByExamIdAndCycleSequenceLessThanOrderByCycleSequenceDesc(1L, 2)).thenReturn(Optional.of(previous));
        when(assignments.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @ParameterizedTest @EnumSource(value = TrainingExamAssignmentStatus.class,
            names = {"ASSIGNED", "FAILED", "EXHAUSTED", "PASSED"})
    void publicationWithRetakeReplacesPreviousVersionObligationAndKeepsHistory(TrainingExamAssignmentStatus status) {
        setup();
        old.setStatus(status);
        var passedAt = status == TrainingExamAssignmentStatus.PASSED ? Instant.parse("2026-10-10T12:00:00Z") : null;
        old.setPassedAt(passedAt);
        var result = service.launchRecertificationCycle(exam, newSpecification, current);
        assertEquals(1, result.size());
        var successor = result.get(0);
        assertSame(newSpecification, successor.getAssessmentSpecification());
        assertSame(current, successor.getAssignmentCycle());
        assertEquals(2, successor.getExamVersionSnapshot());
        assertEquals(TrainingExamAssignmentStatus.ASSIGNED, successor.getStatus());
        assertNull(successor.getPassedAt());
        assertTrue(successor.isActive());
        assertFalse(old.isActive());
        assertSame(successor, old.getReplacedByAssignment());
        assertEquals(status, old.getStatus());
        assertEquals(passedAt, old.getPassedAt());
        assertEquals(TrainingExamAssignmentDeactivationReason.RE_CERTIFICATION_CYCLE, old.getDeactivationReason());
    }

    @Test void staleIdleHistoricalObligationRemainsRejected() {
        setup();
        var staleCycle = CertificationAssignmentCycle.builder().id(19L).exam(exam)
                .assessmentSpecification(oldSpecification).cycleSequence(0).build();
        old.setAssignmentCycle(staleCycle);
        assertThrows(ConflictException.class, () -> service.launchRecertificationCycle(exam, newSpecification, current));
        assertTrue(old.isActive());
        verify(assignments, never()).save(any());
    }
}
