package ru.staffly.schedule.lifecycle;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.dto.ApplyPositionChangeRequest.ScheduleDecision;
import ru.staffly.member.lifecycle.PositionChangeApplyContext;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.service.PublishedShiftImpactClassifier;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.*;
import ru.staffly.user.model.User;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchedulePositionChangeTest {
    private final Instant now = Instant.parse("2026-10-05T12:00:00Z");
    private final ScheduleRepository schedules = mock(ScheduleRepository.class);
    private final ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
    private final SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
    private final SchedulePreferenceLifecycleService lifecycle = mock(SchedulePreferenceLifecycleService.class);
    private final RestaurantTimeService time = mock(RestaurantTimeService.class);
    private final ScheduleOwnershipService ownership = mock(ScheduleOwnershipService.class);
    private final Restaurant restaurant = Restaurant.builder().id(1L).build();
    private final Position oldPosition = Position.builder().id(1L).build();
    private final Position targetPosition = Position.builder().id(2L).build();
    private final RestaurantMember member = RestaurantMember.builder().id(17L).restaurant(restaurant).position(oldPosition)
            .user(User.builder().id(117L).build()).build();
    private final SchedulePositionChangeApplyHandler handler = new SchedulePositionChangeApplyHandler(schedules,
            participations, submissions, lifecycle, time, new PublishedShiftImpactClassifier(), ownership, mock(EntityManager.class),
            mock(ru.staffly.member.repository.RestaurantMemberRepository.class));

    private Schedule schedule(ScheduleStatus status) {
        var schedule = Schedule.builder().id(10L).version(3L).restaurant(restaurant).status(status).build();
        schedule.setPositions(Set.of(oldPosition));
        when(schedules.findByRestaurantIdAndRowMemberId(1L, 17L)).thenReturn(List.of(schedule));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(10L))).thenReturn(List.of(schedule));
        when(time.zoneFor(restaurant)).thenReturn(ZoneOffset.UTC);
        return schedule;
    }
    private ScheduleRow row(Schedule schedule, Long memberId, Long positionId) {
        var row = ScheduleRow.builder().id(memberId).schedule(schedule).memberId(memberId).positionId(positionId).build();
        schedule.getRows().add(row);
        return row;
    }
    private ScheduleCell cell(ScheduleRow row, LocalDate date, int start, int end, ScheduleCellSource source) {
        var cell = ScheduleCell.builder().row(row).day(date).value(start + "-" + end).source(source).build();
        cell.setStructuredShift(new CanonicalBusinessInterval(LocalTime.of(start, 0), 0, LocalTime.of(end, 0), 0));
        row.getCells().add(cell);
        return cell;
    }
    private SchedulePositionChangePreparation apply(Schedule s) {
        var c = new PositionChangeApplyContext(1L, 999L, member, oldPosition, targetPosition, now, UUID.randomUUID());
        var d = new SchedulePositionChangeDecision(List.of(new ScheduleDecision(10L, 3L, s.getStatus(), 0L,
                null, null, null, null, null, null)), List.of(), List.of());
        return handler.applyBefore(c, d);
    }

    @Test void appliedDraftRetainsOtherAutomaticCellsAndManualEdits() {
        var s = schedule(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        var departing = row(s, 17L, 1L);
        var other = row(s, 18L, 1L);
        cell(departing, LocalDate.of(2026, 10, 6), 9, 17, ScheduleCellSource.AUTO_BUILD);
        var generated = cell(other, LocalDate.of(2026, 10, 6), 9, 17, ScheduleCellSource.AUTO_BUILD);
        var manual = cell(other, LocalDate.of(2026, 10, 7), 9, 17, ScheduleCellSource.MANUAL);
        apply(s);
        assertEquals(ScheduleStatus.DRAFT_FROM_PREFERENCES, s.getStatus());
        assertEquals(List.of(other), s.getRows());
        assertEquals(List.of(generated, manual), other.getCells());
        assertEquals(now, s.getAutoBuildStaleAt());
        assertEquals(AutoBuildStaleReason.MEMBER_POSITION_CHANGED, s.getAutoBuildStaleReason());
        verifyNoInteractions(lifecycle);
    }

    @Test void publishedPreservesPastAndCurrentButClearsFutureAndSnapshotsOldPosition() {
        var s = schedule(ScheduleStatus.PUBLISHED);
        var row = row(s, 17L, 1L);
        row.setPositionName("Old position");
        var past = cell(row, LocalDate.of(2026, 10, 4), 9, 17, ScheduleCellSource.MANUAL);
        var current = cell(row, LocalDate.of(2026, 10, 5), 9, 17, ScheduleCellSource.MANUAL);
        cell(row, LocalDate.of(2026, 10, 6), 9, 17, ScheduleCellSource.MANUAL);
        var result = apply(s);
        assertEquals(1, result.cancelledFutureShiftCount());
        assertEquals(List.of(past, current), row.getCells());
        assertTrue(row.isHistorical());
        assertEquals("Old position", row.getPositionName());
        assertEquals(1L, row.getPositionId());
        assertEquals(ScheduleStatus.PUBLISHED, s.getStatus());
    }

    @Test void closedCollectionRemainsClosedAndOldOperationalRowIsRemoved() {
        var s = schedule(ScheduleStatus.PREFERENCES_CLOSED);
        row(s, 17L, 1L);
        apply(s);
        assertEquals(ScheduleStatus.PREFERENCES_CLOSED, s.getStatus());
        assertTrue(s.getRows().isEmpty());
    }

    @Test void historicalRowAloneDoesNotCreateAnAffectedSchedule() {
        var s = schedule(ScheduleStatus.PUBLISHED);
        row(s, 17L, 1L).setHistorical(true);
        var c = new PositionChangeApplyContext(1L, 999L, member, oldPosition, targetPosition, now, UUID.randomUUID());
        var result = handler.applyBefore(c, new SchedulePositionChangeDecision(List.of(), List.of(), List.of()));
        assertTrue(result.affectedScheduleIds().isEmpty());
        verify(schedules, never()).findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(anyLong(), anyList());
    }
}
