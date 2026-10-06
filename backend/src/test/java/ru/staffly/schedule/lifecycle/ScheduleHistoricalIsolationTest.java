package ru.staffly.schedule.lifecycle;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.*;
import ru.staffly.schedule.service.impl.ScheduleAutoBuildApplyServiceImpl;
import ru.staffly.schedule.service.impl.ScheduleShiftRequestServiceImpl;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScheduleHistoricalIsolationTest {
    @Test void creatorWithoutMembershipIsInitialUserOwnerWithoutSyntheticMembership() {
        var members = mock(ru.staffly.member.repository.RestaurantMemberRepository.class);
        var ownership = mock(ru.staffly.training.service.TrainingExamOwnershipService.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(ownership, "members", members);
        var exam = ru.staffly.training.model.TrainingExam.builder()
                .restaurant(Restaurant.builder().id(1L).build())
                .mode(ru.staffly.training.model.TrainingExamMode.CERTIFICATION).build();
        ownership.assignInitialOwner(exam, 7L);
        assertEquals(7L, exam.getCreatedBy().getId());
        assertSame(exam.getCreatedBy(), exam.getOwner());
        assertEquals(7L, exam.getOwner().getId());
        verifyNoInteractions(members);
    }

    @Test void creatorWithoutActiveMembershipIsNotLifecycleReassignmentCandidateOrFallback() {
        var members = mock(ru.staffly.member.repository.RestaurantMemberRepository.class);
        var ownership = mock(ru.staffly.training.service.TrainingExamOwnershipService.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(ownership, "members", members);
        var restaurant = Restaurant.builder().id(1L).build();
        var creator = User.builder().id(7L).build();
        var exam = ru.staffly.training.model.TrainingExam.builder().restaurant(restaurant)
                .mode(ru.staffly.training.model.TrainingExamMode.CERTIFICATION)
                .createdBy(creator).owner(creator).build();
        when(members.findActiveWithUserAndPositionByRestaurantId(1L)).thenReturn(List.of());
        assertTrue(ownership.lifecycleCandidates(exam, 42L, Position.builder().id(2L).build()).isEmpty());
        assertThrows(ru.staffly.common.exception.BadRequestException.class,
                () -> ownership.validateOwnerCandidate(exam, creator.getId()));
        assertSame(creator, exam.getOwner());
        verify(members).findActiveWithUserAndPositionByRestaurantId(1L);
        verify(members).findActiveByUserIdAndRestaurantIdWithPosition(7L, 1L);
        verifyNoMoreInteractions(members);
    }

    final LocalDate day = LocalDate.of(2026, 10, 6);
    final Schedule schedule = Schedule.builder().id(10L).version(1L)
            .startDate(day).endDate(day).status(ScheduleStatus.COLLECTING_PREFERENCES).build();
    final ScheduleRow active = ScheduleRow.builder().id(11L).memberId(42L).positionId(2L).build();
    final ScheduleRow historical = ScheduleRow.builder().id(12L).memberId(42L)
            .positionId(1L).historical(true).build();

    @Test void autoBuildUsesActiveRowAndPreservesHistoricalCellsForSameMember() {
        schedule.getRows().addAll(List.of(active, historical));
        active.getCells().add(ScheduleCell.builder().day(day).value("new").build());
        historical.getCells().add(ScheduleCell.builder().day(day).value("old").build());
        var service = mock(ScheduleAutoBuildApplyServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "entityManager", mock(EntityManager.class));
        Map<Long, ScheduleRow> indexed = ReflectionTestUtils.invokeMethod(service, "indexRowsByMember", schedule);
        assertSame(active, indexed.get(42L));
        ReflectionTestUtils.invokeMethod(service, "clearAffectedCells", schedule, Set.of(2L), Map.of(42L, 2L));
        assertTrue(active.getCells().isEmpty());
        assertEquals("old", historical.getCells().get(0).getValue());
    }

    @Test void pendingRequestCannotApproveHistoricalRowEvenWhenCellSnapshotMatches() {
        var service = mock(ScheduleShiftRequestServiceImpl.class, CALLS_REAL_METHODS);
        historical.getCells().add(ScheduleCell.builder().day(day).value("shift").build());
        var request = ScheduleShiftRequest.builder().type(ScheduleShiftRequestType.REPLACEMENT)
                .dayFrom(day).fromShiftValueSnapshot("shift").build();
        String reason = ReflectionTestUtils.invokeMethod(service, "getStaleReason", request, historical, active);
        assertNotNull(reason);
    }

    @Test void materializationKeepsOldPositionHistoryAndAlignsActiveSnapshot() {
        schedule.getRows().addAll(List.of(active, historical));
        var member = RestaurantMember.builder().id(42L).user(User.builder().firstName("Anna").build()).build();
        var participation = ScheduleParticipation.builder().positionId(3L).positionName("Manager").build();
        var result = new ScheduleRowMaterializer().ensureRowWithLocksHeld(schedule, member, participation);
        assertSame(active, result);
        assertEquals(3L, active.getPositionId());
        assertEquals("Manager", active.getPositionName());
        assertEquals(1L, historical.getPositionId());
        assertEquals(2, schedule.getRows().size());
    }

    @Test void preferenceRemovalDropsOnlyActiveRowAndResetRetainsParticipation() {
        var participants = mock(ScheduleParticipationRepository.class);
        var submissions = mock(SchedulePreferenceSubmissionRepository.class);
        var schedules = mock(ScheduleRepository.class);
        var members = mock(ru.staffly.member.repository.RestaurantMemberRepository.class);
        var member = RestaurantMember.builder().id(42L).build();
        when(members.findForUpdateByIdAndRestaurantId(42L, 1L)).thenReturn(Optional.of(member));
        when(schedules.findForUpdateByIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(schedule));
        schedule.getParticipations().add(ScheduleParticipation.builder().schedule(schedule).member(member)
                .positionId(2L).positionName("Current").build());
        schedule.getRows().addAll(List.of(active, historical));
        var service = new SchedulePreferenceLifecycleService(members, schedules, participants, submissions,
                new ScheduleParticipationCreator(participants), new ScheduleRowMaterializer(), mock(ScheduleAuditService.class));
        service.removeParticipant(1L, 10L, 42L, 1L, 7L, "test");
        assertTrue(schedule.getParticipations().isEmpty());
        assertEquals(List.of(historical), schedule.getRows());
        service.resetPreferenceCollectionWithLocksHeld(schedule, 7L, "test");
        assertEquals(ScheduleStatus.DRAFT, schedule.getStatus());
    }

    @Test void endedPeriodCannotBecomeParticipant() {
        var participants = mock(ScheduleParticipationRepository.class);
        var member = RestaurantMember.builder().id(17L).endedAt(Instant.EPOCH)
                .restaurant(Restaurant.builder().id(1L).build()).position(Position.builder().id(2L).build()).build();
        assertThrows(ru.staffly.common.exception.BadRequestException.class,
                () -> new ScheduleParticipationCreator(participants).createWithLocksHeld(schedule, member, true));
        verify(participants, never()).save(any());
    }

    @Test void sharedLifecycleRemovalKeepsOtherParticipantsAndHistoricalRows() {
        var participants = mock(ScheduleParticipationRepository.class);
        var submissions = mock(SchedulePreferenceSubmissionRepository.class);
        var departing = RestaurantMember.builder().id(42L).build();
        var other = RestaurantMember.builder().id(43L).build();
        var retained = ScheduleParticipation.builder().schedule(schedule).member(other)
                .positionId(2L).positionName("Other").build();
        schedule.getParticipations().add(ScheduleParticipation.builder().schedule(schedule).member(departing)
                .positionId(1L).positionName("Old").build());
        schedule.getParticipations().add(retained);
        schedule.getRows().add(historical);
        var service = new SchedulePreferenceLifecycleService(mock(ru.staffly.member.repository.RestaurantMemberRepository.class),
                mock(ScheduleRepository.class), participants, submissions, new ScheduleParticipationCreator(participants),
                new ScheduleRowMaterializer(), mock(ScheduleAuditService.class));
        var result = service.removeParticipantWithLocksHeld(schedule, departing, 7L, "lifecycle", Instant.EPOCH);
        assertTrue(result.participationRemoved());
        assertEquals(List.of(retained), schedule.getParticipations());
        assertEquals(List.of(historical), schedule.getRows());
        assertFalse(service.removeParticipantWithLocksHeld(schedule, departing, 7L, "lifecycle", Instant.EPOCH).changed());
    }
}
