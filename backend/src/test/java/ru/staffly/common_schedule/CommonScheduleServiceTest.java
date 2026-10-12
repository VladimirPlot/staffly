package ru.staffly.common_schedule;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.*;
import ru.staffly.common_schedule.dto.CommonScheduleRequest;
import ru.staffly.common_schedule.model.CommonSchedule;
import ru.staffly.common_schedule.repository.CommonScheduleRepository;
import ru.staffly.common_schedule.service.*;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.*;
import ru.staffly.security.SecurityService;

import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CommonScheduleServiceTest {
    final CommonScheduleRepository commonSchedules = mock(CommonScheduleRepository.class);
    final ScheduleRepository schedules = mock(ScheduleRepository.class);
    final RestaurantRepository restaurants = mock(RestaurantRepository.class);
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final ScheduleAccessService access = mock(ScheduleAccessService.class);
    final SecurityService security = mock(SecurityService.class);
    final RestaurantLifecycleMutex mutex = mock(RestaurantLifecycleMutex.class);
    final ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
    final ScheduleContentMapper mapper = new ScheduleContentMapper(participations);
    final CommonScheduleService service = new CommonScheduleService(commonSchedules, schedules, restaurants,
            members, access, security, mutex, mapper);
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final Schedule primary = source(10L, "Бар", 1, 31, 2L);
    final Schedule secondary = source(20L, "Зал", 5, 20, 3L);
    CommonSchedule common;

    Schedule source(long id, String title, int start, int end, long positionId) {
        return Schedule.builder().id(id).version(1L).restaurant(restaurant).title(title)
                .startDate(LocalDate.of(2026, 10, start)).endDate(LocalDate.of(2026, 10, end))
                .status(ScheduleStatus.PUBLISHED).shiftMode(ScheduleShiftMode.FULL)
                .positions(new LinkedHashSet<>(List.of(Position.builder().id(positionId).build()))).build();
    }

    @BeforeEach void setup() {
        common = new CommonSchedule();
        common.setId(30L); common.setVersion(4L); common.setTitle("Общий"); common.setRestaurant(restaurant);
        common.getSources().addAll(List.of(primary, secondary));
        when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant));
        when(commonSchedules.findByIdAndRestaurantId(30L, 1L)).thenReturn(Optional.of(common));
        when(commonSchedules.findByRestaurantIdOrderByIdDesc(1L)).thenReturn(List.of(common));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(10L, 20L)))
                .thenReturn(List.of(primary, secondary));
        when(commonSchedules.saveAndFlush(any())).thenAnswer(invocation -> {
            CommonSchedule saved = invocation.getArgument(0);
            if (saved.getId() == null) { saved.setId(30L); saved.setVersion(0L); }
            return saved;
        });
    }

    CommonScheduleRequest request(List<Long> ids) { return new CommonScheduleRequest(" Общий ", ids, false, 4L); }
    void staff(long positionId) {
        when(members.findActiveByUserIdAndRestaurantId(7L, 1L)).thenReturn(Optional.of(
                RestaurantMember.builder().position(Position.builder().id(positionId).level(RestaurantRole.STAFF).build()).build()));
    }

    @Test void createsReferenceViewWithNestedPeriodsAndSafeDefaultVisibility() {
        var result = service.create(1L, 7L, request(List.of(10L, 20L)));
        assertEquals("Общий", result.summary().title());
        assertEquals(primary.getStartDate(), result.summary().startDate());
        assertEquals(primary.getEndDate(), result.summary().endDate());
        assertEquals(List.of(10L, 20L), result.summary().scheduleIds());
        assertFalse(result.summary().visibleToPositions());
        verify(mutex).lock(1L);
        verify(access).assertCanManageSchedules(7L, 1L);
        verifyNoInteractions(members);
    }

    @Test void acceptsEqualPeriodsAndInclusiveBoundaries() {
        secondary.setStartDate(primary.getStartDate()); secondary.setEndDate(primary.getEndDate());
        assertDoesNotThrow(() -> service.create(1L, 7L, request(List.of(10L, 20L))));
    }

    @Test void rejectsOneDuplicateAndNullSourcesBeforeSaving() {
        for (var ids : List.of(List.of(10L), List.of(10L, 10L), Arrays.asList(10L, null))) {
            assertThrows(BadRequestException.class, () -> service.create(1L, 7L, request(ids)));
        }
        verify(commonSchedules, never()).saveAndFlush(any());
    }

    @Test void rejectsPartialOverlapOnEitherSide() {
        secondary.setStartDate(primary.getStartDate().minusDays(1));
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L, request(List.of(10L, 20L))));
        secondary.setStartDate(primary.getStartDate()); secondary.setEndDate(primary.getEndDate().plusDays(1));
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L, request(List.of(10L, 20L))));
        verify(commonSchedules, never()).saveAndFlush(any());
    }

    @Test void rejectsUnpublishedAndCrossRestaurantSources() {
        secondary.setStatus(ScheduleStatus.DRAFT);
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L, request(List.of(10L, 20L))));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(10L, 20L)))
                .thenReturn(List.of(primary));
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L, request(List.of(10L, 20L))));
        verify(commonSchedules, never()).saveAndFlush(any());
    }

    @Test void firstRequestedSourceDefinesPeriodRatherThanLockOrder() {
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(20L, 10L)))
                .thenReturn(List.of(primary, secondary));
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L, request(List.of(20L, 10L))));
        secondary.setStartDate(primary.getStartDate()); secondary.setEndDate(primary.getEndDate());
        var result = service.create(1L, 7L, request(List.of(20L, 10L)));
        assertEquals(List.of(20L, 10L), result.summary().scheduleIds());
    }

    @Test void managerCanViewPrivateScheduleWithoutMembership() {
        when(access.canManageSchedules(7L, 1L)).thenReturn(true);
        assertEquals(1, service.list(1L, 7L).size());
        assertEquals(2, service.get(1L, 30L, 7L).sources().size());
        verifyNoInteractions(members);
    }

    @Test void staffRequiresFlagAndCurrentMatchingPosition() {
        staff(3L);
        assertTrue(service.list(1L, 7L).isEmpty());
        assertThrows(ForbiddenException.class, () -> service.get(1L, 30L, 7L));
        common.setVisibleToPositions(true);
        assertEquals(1, service.list(1L, 7L).size());
        assertEquals(2, service.get(1L, 30L, 7L).sources().size());
        staff(99L);
        assertTrue(service.list(1L, 7L).isEmpty());
        assertThrows(ForbiddenException.class, () -> service.get(1L, 30L, 7L));
        verify(access, never()).assertCanViewSchedule(any(), any());
    }

    @Test void endedMembershipAndOtherRestaurantAreNotAuthorized() {
        common.setVisibleToPositions(true);
        when(members.findActiveByUserIdAndRestaurantId(7L, 1L)).thenReturn(Optional.empty());
        assertThrows(ForbiddenException.class, () -> service.get(1L, 30L, 7L));
        assertThrows(NotFoundException.class, () -> service.get(2L, 30L, 7L));
    }

    @Test void settingsAndDeleteRequireManagementAndCurrentVersion() {
        assertThrows(ConflictException.class, () -> service.update(1L, 30L, 7L,
                new CommonScheduleRequest("Общий", List.of(10L, 20L), true, 3L)));
        assertThrows(ConflictException.class, () -> service.delete(1L, 30L, 7L, 3L));
        assertThrows(ConflictException.class, () -> service.delete(1L, 30L, 7L, null));
        service.update(1L, 30L, 7L, new CommonScheduleRequest("Новое имя", List.of(10L, 20L), true, 4L));
        assertTrue(common.isVisibleToPositions()); assertEquals("Новое имя", common.getTitle());
        service.delete(1L, 30L, 7L, 4L);
        verify(commonSchedules).delete(common);
        verify(schedules, never()).delete(any());
        doThrow(new ForbiddenException("Нет прав")).when(access).assertCanManageSchedules(7L, 1L);
        assertThrows(ForbiddenException.class, () -> service.create(1L, 7L, request(List.of(10L, 20L))));
        assertThrows(ForbiddenException.class, () -> service.delete(1L, 30L, 7L, 4L));
    }

    @Test void readsLiveCellsAndPreservesHistoricalRowsWithoutParticipation() {
        when(access.canManageSchedules(7L, 1L)).thenReturn(true);
        var historical = ScheduleRow.builder().id(100L).memberId(9L).historical(true)
                .displayName("Анна").positionName("Бармен").build();
        var cell = ScheduleCell.builder().day(primary.getStartDate()).value("09:00-17:00").build();
        historical.getCells().add(cell); primary.getRows().add(historical);
        primary.getRows().add(ScheduleRow.builder().id(101L).memberId(99L).displayName("Не участник").build());
        var first = service.get(1L, 30L, 7L).sources().get(0).content();
        assertEquals(1, first.rows().size()); assertTrue(first.rows().get(0).historical());
        assertEquals("09:00-17:00", first.cellValues().get("-100:2026-10-01"));
        cell.setValue("10:00-18:00");
        assertEquals("10:00-18:00", service.get(1L, 30L, 7L).sources().get(0).content()
                .cellValues().get("-100:2026-10-01"));
        assertEquals("09:00-17:00", first.cellValues().get("-100:2026-10-01"));
    }

    @Test void dependencyGuardProtectsSourcesAndAllowsCompatibleChanges() {
        var guard = new CommonScheduleDependencies(commonSchedules);
        when(commonSchedules.findDependingOn(10L)).thenReturn(List.of(common));
        when(commonSchedules.findDependingOn(20L)).thenReturn(List.of(common));
        assertTrue(assertThrows(ConflictException.class, () -> guard.assertCanDelete(10L)).getMessage().contains("Общий"));
        assertDoesNotThrow(() -> guard.assertCanDelete(99L));
        assertDoesNotThrow(() -> guard.assertCompatiblePeriod(primary, primary.getStartDate(), primary.getEndDate()));
        assertDoesNotThrow(() -> guard.assertCompatiblePeriod(primary, primary.getStartDate().minusDays(1), primary.getEndDate()));
        assertThrows(ConflictException.class, () -> guard.assertCompatiblePeriod(primary,
                LocalDate.of(2026, 10, 6), primary.getEndDate()));
        assertThrows(ConflictException.class, () -> guard.assertCompatiblePeriod(primary,
                primary.getStartDate(), LocalDate.of(2026, 10, 19)));
        assertDoesNotThrow(() -> guard.assertCompatiblePeriod(secondary, primary.getStartDate(), primary.getEndDate()));
        assertThrows(ConflictException.class, () -> guard.assertCompatiblePeriod(secondary,
                primary.getStartDate(), primary.getEndDate().plusDays(1)));
    }
}
