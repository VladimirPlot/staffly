package ru.staffly.member.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.EmployeeRemovalAuditRepository;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.responsibility.MemberResponsibilityHandoffService;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.training.service.CertificationAudienceSyncService;
import ru.staffly.user.model.User;

import java.time.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmployeeRemovalApplyServiceTest {
    @Mock RestaurantMemberRepository members;
    @Mock ScheduleRepository schedules;
    @Mock ScheduleParticipationRepository participations;
    @Mock SchedulePreferenceSubmissionRepository submissions;
    @Mock SchedulePreferenceLifecycleService lifecycle;
    @Mock MemberRemovalPolicyService removalPolicy;
    @Mock MemberResponsibilityHandoffService responsibilityHandoff;
    @Mock RestaurantTimeService restaurantTime;
    @Mock EmployeeRemovalAuditRepository audits;
    @Mock CertificationAudienceSyncService certificationSync;

    private EmployeeRemovalApplyService service;
    private RestaurantMember member;
    private final Instant createdAt = Instant.parse("2026-09-20T10:00:00Z");

    @BeforeEach
    void setUp() {
        service = new EmployeeRemovalApplyService(members, schedules, participations, submissions, lifecycle,
                removalPolicy, responsibilityHandoff, new PublishedShiftImpactClassifier(), restaurantTime,
                audits, certificationSync);
        member = RestaurantMember.builder().id(7L).createdAt(createdAt)
                .restaurant(Restaurant.builder().id(3L).build()).user(User.builder().id(9L).build()).build();
        when(members.findForUpdateByIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(member));
    }

    @Test
    void staleScheduleTokenPerformsNoMutation() {
        Schedule schedule = schedule(11L, ScheduleStatus.COLLECTING_PREFERENCES, 4L);
        affectedByRow(schedule);
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(11L)))
                .thenReturn(List.of(schedule));

        var request = request(schedule, 3L);
        assertThrows(ConflictException.class, () -> service.apply(3L, 7L, request, 5L));

        verify(members, never()).delete(any());
        verify(lifecycle, never()).removeParticipantWithLocksHeld(any(), any(), any(), any());
        verify(audits, never()).save(any());
    }

    @Test
    void successfulSelfLeaveUsesAtomicRemovalWithoutBroadcastDependency() {
        when(schedules.findByRestaurantIdAndParticipantMemberId(3L, 7L)).thenReturn(List.of());
        when(schedules.findByRestaurantIdAndSubmissionMemberId(3L, 7L)).thenReturn(List.of());
        when(schedules.findByRestaurantIdAndRowMemberId(3L, 7L)).thenReturn(List.of());
        when(restaurantTime.nowInstant()).thenReturn(Instant.parse("2026-09-20T12:00:00Z"));

        service.apply(3L, 7L, new ApplyEmployeeRemovalRequest(createdAt, null, List.of()), 9L);

        verify(members).delete(member);
        verify(audits).save(any());
    }

    @Test
    void responsibilityConflictPreventsPhysicalSelfDeletion() {
        doThrow(new ConflictException("handoff required"))
                .when(responsibilityHandoff).assertNoBlockingResponsibilities(3L, 9L);

        assertThrows(ConflictException.class,
                () -> service.apply(3L, 7L, new ApplyEmployeeRemovalRequest(createdAt, null, List.of()), 9L));

        verify(members, never()).delete(any());
    }

    @Test
    void appliedPreferenceDraftUsesNarrowInvalidation() {
        Schedule schedule = schedule(12L, ScheduleStatus.DRAFT_FROM_PREFERENCES, 2L);
        affectedByRow(schedule);
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(12L)))
                .thenReturn(List.of(schedule));
        when(restaurantTime.nowInstant()).thenReturn(Instant.parse("2026-09-20T12:00:00Z"));
        when(restaurantTime.zoneFor(any())).thenReturn(ZoneOffset.UTC);

        var result = service.apply(3L, 7L, request(schedule, 2L), 5L);

        verify(lifecycle).invalidateAppliedPreferenceDraftWithLocksHeld(schedule, 5L, "Удаление участника");
        verify(lifecycle, never()).invalidatePreferenceCollectionWithLocksHeld(any(), any(), any());
        assertEquals(1, result.invalidatedAppliedPreferenceDraftCount());
        verify(members).delete(member);
    }

    @Test
    void draftFromPreferencesWithOnlyActiveRowStillInvalidatesAppliedResult() {
        Schedule schedule = schedule(14L, ScheduleStatus.DRAFT_FROM_PREFERENCES, 7L);
        when(schedules.findByRestaurantIdAndParticipantMemberId(3L, 7L)).thenReturn(List.of());
        when(schedules.findByRestaurantIdAndSubmissionMemberId(3L, 7L)).thenReturn(List.of());
        when(schedules.findByRestaurantIdAndRowMemberId(3L, 7L)).thenReturn(List.of(schedule));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(14L)))
                .thenReturn(List.of(schedule));
        when(participations.findByScheduleIdAndMemberId(14L, 7L)).thenReturn(Optional.empty());
        when(submissions.findByScheduleIdAndMemberId(14L, 7L)).thenReturn(Optional.empty());
        when(restaurantTime.nowInstant()).thenReturn(Instant.parse("2026-09-20T12:00:00Z"));
        when(restaurantTime.zoneFor(any())).thenReturn(ZoneOffset.UTC);

        var result = service.apply(3L, 7L, request(schedule, 7L), 5L);

        verify(lifecycle, times(1))
                .invalidateAppliedPreferenceDraftWithLocksHeld(schedule, 5L, "Удаление участника");
        verify(lifecycle, never()).invalidatePreferenceCollectionWithLocksHeld(any(), any(), any());
        verify(lifecycle, never()).removeParticipantWithLocksHeld(any(), any(), any(), any());
        assertEquals(1, result.invalidatedAppliedPreferenceDraftCount());
        verify(members).delete(member);
    }

    @Test
    void publishedApplyCancelsOnlyFutureStructuredShiftAndPreservesHistory() {
        LocalDate day = LocalDate.of(2026, 9, 20);
        ScheduleRow row = ScheduleRow.builder().memberId(7L).historical(false).cells(new ArrayList<>()).build();
        row.getCells().add(cell(row, day, LocalTime.of(9, 0), LocalTime.of(10, 0))); // elapsed
        row.getCells().add(cell(row, day, LocalTime.of(12, 0), LocalTime.of(13, 0))); // start == now
        row.getCells().add(cell(row, day, LocalTime.of(14, 0), LocalTime.of(15, 0))); // future
        row.getCells().add(ScheduleCell.builder().row(row).day(day).value("legacy").build());
        Schedule schedule = schedule(13L, ScheduleStatus.PUBLISHED, 6L);
        schedule.setRows(new ArrayList<>(List.of(row)));
        affectedByRow(schedule);
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(13L)))
                .thenReturn(List.of(schedule));
        when(restaurantTime.nowInstant()).thenReturn(Instant.parse("2026-09-20T12:00:00Z"));
        when(restaurantTime.zoneFor(any())).thenReturn(ZoneOffset.UTC);

        var result = service.apply(3L, 7L, request(schedule, 6L), 5L);

        assertTrue(row.isHistorical());
        assertEquals(3, row.getCells().size());
        assertTrue(row.getCells().stream().anyMatch(cell -> "legacy".equals(cell.getValue())));
        assertEquals(1, result.cancelledFutureShiftCount());
        assertEquals(1, result.historicalPublishedRowCount());
    }

    private void affectedByRow(Schedule schedule) {
        when(schedules.findByRestaurantIdAndParticipantMemberId(3L, 7L)).thenReturn(List.of());
        when(schedules.findByRestaurantIdAndSubmissionMemberId(3L, 7L)).thenReturn(List.of());
        when(schedules.findByRestaurantIdAndRowMemberId(3L, 7L)).thenReturn(List.of(schedule));
        when(participations.findByScheduleIdAndMemberId(schedule.getId(), 7L)).thenReturn(Optional.empty());
        when(submissions.findByScheduleIdAndMemberId(schedule.getId(), 7L)).thenReturn(Optional.empty());
    }

    private Schedule schedule(Long id, ScheduleStatus status, Long version) {
        return Schedule.builder().id(id).version(version).restaurant(member.getRestaurant()).status(status)
                .preferenceCollectionCycle(1L).rows(new ArrayList<>(List.of(
                        ScheduleRow.builder().memberId(7L).historical(false).cells(new ArrayList<>()).build())))
                .build();
    }

    private ApplyEmployeeRemovalRequest request(Schedule schedule, Long expectedVersion) {
        return new ApplyEmployeeRemovalRequest(createdAt, null, List.of(
                new ApplyEmployeeRemovalRequest.ScheduleToken(schedule.getId(), expectedVersion,
                        schedule.getStatus(), schedule.getPreferenceCollectionCycle(), null,
                        null, null, null)));
    }

    private ScheduleCell cell(ScheduleRow row, LocalDate day, LocalTime start, LocalTime end) {
        return ScheduleCell.builder().row(row).day(day).value("shift")
                .shiftStartTime(start).shiftStartDayOffset(0)
                .shiftEndTime(end).shiftEndDayOffset(0).build();
    }
}
