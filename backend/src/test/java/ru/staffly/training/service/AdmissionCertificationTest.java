package ru.staffly.training.service;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
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

class AdmissionCertificationTest {
    final TrainingExamAssignmentRepository assignments = mock(TrainingExamAssignmentRepository.class);
    final TrainingExamAttemptRepository attempts = mock(TrainingExamAttemptRepository.class);
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final CertificationAssessmentSpecificationService specs = mock(CertificationAssessmentSpecificationService.class);
    final CertificationAssignmentCycleRepository cycles = mock(CertificationAssignmentCycleRepository.class);
    final CertificationAssignmentService service = new CertificationAssignmentService(assignments,attempts,members,specs,cycles,mock(EntityManager.class));
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final Position position = Position.builder().id(2L).restaurant(restaurant).build();
    final User user = User.builder().id(7L).build();
    final RestaurantMember member = RestaurantMember.builder().id(42L).user(user).restaurant(restaurant).position(position).build();
    final TrainingExam exam = TrainingExam.builder().id(10L).restaurant(restaurant).mode(TrainingExamMode.CERTIFICATION)
            .active(true).visibilityPositions(Set.of(position)).build();
    final Instant passedAt = Instant.parse("2026-10-01T12:00:00Z");
    void audience(CertificationAssessmentSpecification spec,CertificationAssignmentCycle cycle) {
        when(members.findActiveWithUserAndPositionByRestaurantId(1L)).thenReturn(List.of(member));
        when(assignments.findAllActiveAssignmentsForCycleTransition(10L,1L)).thenReturn(List.of());
        when(specs.requireCurrent(exam)).thenReturn(spec);
        when(cycles.findTopByExamIdAndAssessmentSpecificationIdOrderByCycleSequenceDesc(10L,spec.getId())).thenReturn(Optional.of(cycle));
    }
    @Test void sameVersionHistoricalPassSatisfiesRehireWithoutNewObligation() {
        var spec = CertificationAssessmentSpecification.builder().id(30L).exam(exam).version(3).build();
        var cycle = CertificationAssignmentCycle.builder().id(40L).exam(exam).assessmentSpecification(spec).build();
        var old = TrainingExamAssignment.builder().id(17L).exam(exam).restaurant(restaurant).user(user)
                .assessmentSpecification(spec).assignmentCycle(cycle).examVersionSnapshot(3).status(TrainingExamAssignmentStatus.PASSED)
                .passedAt(passedAt).active(false).deactivationReason(TrainingExamAssignmentDeactivationReason.AUDIENCE_REMOVED).build();
        audience(spec,cycle);
        when(assignments.findAudienceRemovedForExactCycle(10L,1L,7L,30L,40L)).thenReturn(List.of(old));
        when(attempts.findCountedFinishedByAssignmentAndVersion(17L,3)).thenReturn(List.of(TrainingExamAttempt.builder()
                .finishedAt(passedAt).passed(true).scorePercent(100).build()));
        var result = service.syncAudienceAssignmentsWithEffects(exam);
        assertTrue(result.createdAssignments().isEmpty()); assertTrue(old.isActive());
        assertEquals(TrainingExamAssignmentStatus.PASSED,old.getStatus());assertEquals(passedAt,old.getPassedAt());
        verify(assignments,never()).save(any());
    }
    @Test void changedVersionGetsCurrentObligationAndDoesNotBorrowOldPass() {
        var spec = CertificationAssessmentSpecification.builder().id(31L).exam(exam).version(4).build();
        var cycle = CertificationAssignmentCycle.builder().id(41L).exam(exam).assessmentSpecification(spec).build();
        audience(spec,cycle);
        when(assignments.findAudienceRemovedForExactCycle(10L,1L,7L,31L,41L)).thenReturn(List.of());
        when(assignments.save(any())).thenAnswer(a -> a.getArgument(0));
        var result = service.syncAudienceAssignmentsWithEffects(exam);var current = result.createdAssignments().get(0);
        assertEquals(4,current.getExamVersionSnapshot());assertNull(current.getPassedAt());
        assertEquals(TrainingExamAssignmentStatus.ASSIGNED,current.getStatus());assertSame(spec,current.getAssessmentSpecification());
    }
}
