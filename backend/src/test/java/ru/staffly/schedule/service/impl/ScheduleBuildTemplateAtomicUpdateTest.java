package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.exception.ScheduleBuildTemplateConfirmationRequiredException;
import ru.staffly.schedule.exception.ScheduleBuildTemplateVersionConflictException;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.*;
import ru.staffly.security.SecurityService;

import java.time.LocalTime;
import org.hibernate.annotations.OptimisticLock;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static ru.staffly.schedule.service.ScheduleBuildTemplateChangeImpact.*;
import static ru.staffly.schedule.service.ScheduleBuildTemplateScheduleAction.*;

@ExtendWith(MockitoExtension.class)
class ScheduleBuildTemplateAtomicUpdateTest {
    @Mock ScheduleBuildTemplateRepository templates;
    @Mock ScheduleRepository schedules;
    @Mock RestaurantRepository restaurants;
    @Mock PositionRepository positions;
    @Mock SecurityService security;
    @Mock ScheduleAccessService access;
    @Mock ScheduleBuildTemplateImpactPlanner planner;
    @Mock SchedulePreferenceLifecycleService lifecycle;
    @Mock EntityManager entityManager;

    ScheduleBuildTemplateServiceImpl service;
    ScheduleBuildTemplate optimisticTemplate;
    ScheduleBuildTemplate template;
    SaveScheduleBuildTemplateRequest request;

    @BeforeEach
    void setUp() {
        service = new ScheduleBuildTemplateServiceImpl(templates, schedules, restaurants, positions,
                security, access, planner, lifecycle, entityManager);
        Restaurant restaurant = Restaurant.builder().id(1L).build();
        Position position = Position.builder().id(2L).name("Cook").restaurant(restaurant).build();
        optimisticTemplate = ScheduleBuildTemplate.builder().id(10L).version(4L).restaurant(restaurant)
                .name("Old").isActive(true).build();
        template = ScheduleBuildTemplate.builder().id(10L).version(4L).restaurant(restaurant)
                .name("Old").isActive(true).build();
        request = request(false, 4L);
        lenient().when(templates.findByIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(optimisticTemplate));
        lenient().when(templates.findForUpdateByIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(template));
        lenient().when(positions.findAllById(any())).thenReturn(List.of(position));
        lenient().when(templates.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void noneShortCircuitsWithoutRewritingOrLifecycleMutation() {
        SaveScheduleBuildTemplateRequest identical = request("Old", true, false, 4L);
        when(planner.plan(template, identical, List.of())).thenReturn(plan(NONE));

        service.update(1L, 10L, 7L, identical);

        verify(templates, never()).saveAndFlush(any());
        verifyOnlyOptimisticDetach();
        verifyNoInteractions(lifecycle);
        assertThat(template.getName()).isEqualTo("Old");
    }

    @Test
    void neutralMetadataUpdatesWithoutConfirmationOrLifecycleMutation() {
        when(planner.plan(template, request, List.of())).thenReturn(plan(NEUTRAL_METADATA));

        service.update(1L, 10L, 7L, request);

        assertThat(template.getName()).isEqualTo("New");
        verify(templates).saveAndFlush(template);
        verify(entityManager).detach(optimisticTemplate);
        verify(entityManager, never()).lock(any(), any());
        verifyNoInteractions(lifecycle);
    }

    @Test
    void destructiveUnconfirmedPlanReturnsStructuredConflictBeforeMutation() {
        Schedule locked = schedule(21L, DRAFT_FROM_PREFERENCES);
        lock(List.of(21L), List.of(locked));
        ScheduleBuildTemplateImpactPlan plan = plan(PLANNER_AFFECTING,
                impact(locked, INVALIDATE_APPLIED_AUTO_BUILD));
        when(planner.plan(template, request, List.of(locked))).thenReturn(plan);

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, request))
                .isInstanceOf(ScheduleBuildTemplateConfirmationRequiredException.class)
                .satisfies(error -> assertThat(((ScheduleBuildTemplateConfirmationRequiredException) error).getMeta())
                        .containsEntry("impact", PLANNER_AFFECTING)
                        .containsEntry("hasDestructiveConsequences", true)
                        .containsKeys("schedules", "summary"));

        assertThat(template.getName()).isEqualTo("Old");
        verifyNoInteractions(lifecycle);
        verify(templates, never()).saveAndFlush(any());
        verifyOnlyOptimisticDetach();
    }

    @Test
    void confirmedPlannerChangeUsesNarrowInvalidationOnLockedEntity() {
        Schedule locked = schedule(21L, DRAFT_FROM_PREFERENCES);
        SaveScheduleBuildTemplateRequest confirmed = request(true, 4L);
        lock(List.of(21L), List.of(locked));
        when(planner.plan(template, confirmed, List.of(locked))).thenReturn(plan(PLANNER_AFFECTING,
                impact(locked, INVALIDATE_APPLIED_AUTO_BUILD)));

        service.update(1L, 10L, 7L, confirmed);

        InOrder order = inOrder(planner, lifecycle, templates);
        order.verify(planner).plan(template, confirmed, List.of(locked));
        order.verify(lifecycle).invalidateAppliedPreferenceDraftWithLocksHeld(locked, 7L,
                "Изменение шаблона сборки графика");
        order.verify(templates).saveAndFlush(template);
        verify(lifecycle, never()).resetPreferenceCollectionWithLocksHeld(any(), any(), any());
    }

    @Test
    void childOnlyChangeUsesForcedAggregateVersionIncrement() {
        SaveScheduleBuildTemplateRequest childOnly = request("Old", true, false, 4L);
        when(planner.plan(template, childOnly, List.of())).thenReturn(plan(PLANNER_AFFECTING));

        service.update(1L, 10L, 7L, childOnly);

        verify(entityManager).detach(optimisticTemplate);
        verify(entityManager).lock(template, LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        verify(templates).saveAndFlush(template);
        try {
            assertThat(ScheduleBuildTemplate.class.getDeclaredField("positionConfigs")
                    .getAnnotation(OptimisticLock.class).excluded()).isTrue();
        } catch (NoSuchFieldException exception) {
            throw new AssertionError(exception);
        }
    }

    @Test
    void parentScalarChangeUsesNormalSingleVersionedFlushWithoutForcedIncrement() {
        when(planner.plan(template, request, List.of())).thenReturn(plan(NEUTRAL_METADATA));

        service.update(1L, 10L, 7L, request);

        verify(entityManager).detach(optimisticTemplate);
        verify(entityManager, never()).lock(any(), any());
        verify(templates, times(1)).saveAndFlush(template);
    }

    @Test
    void confirmedPreferenceChangeFullyResetsEveryActiveStateButNotDraftOrPublished() {
        List<Schedule> locked = List.of(schedule(1L, DRAFT), schedule(2L, COLLECTING_PREFERENCES),
                schedule(3L, PREFERENCES_CLOSED), schedule(4L, DRAFT_FROM_PREFERENCES),
                schedule(5L, PUBLISHED));
        SaveScheduleBuildTemplateRequest confirmed = request(true, 4L);
        lock(List.of(1L, 2L, 3L, 4L, 5L), locked);
        when(planner.plan(template, confirmed, locked)).thenReturn(plan(PREFERENCE_AFFECTING,
                impact(locked.get(0), NO_ACTION), impact(locked.get(1), RESET_PREFERENCE_COLLECTION),
                impact(locked.get(2), RESET_PREFERENCE_COLLECTION),
                impact(locked.get(3), RESET_PREFERENCE_COLLECTION),
                impact(locked.get(4), PUBLISHED_UNCHANGED)));

        service.update(1L, 10L, 7L, confirmed);

        verify(lifecycle).resetPreferenceCollectionWithLocksHeld(locked.get(1), 7L, "Изменение шаблона сборки графика");
        verify(lifecycle).resetPreferenceCollectionWithLocksHeld(locked.get(2), 7L, "Изменение шаблона сборки графика");
        verify(lifecycle).resetPreferenceCollectionWithLocksHeld(locked.get(3), 7L, "Изменение шаблона сборки графика");
        verifyNoMoreInteractions(lifecycle);
    }

    @Test
    void confirmationCannotBypassStaleTemplateVersion() {
        SaveScheduleBuildTemplateRequest staleConfirmed = request(true, 3L);

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, staleConfirmed))
                .isInstanceOf(ScheduleBuildTemplateVersionConflictException.class);

        verifyNoInteractions(planner, lifecycle);
        verifyNoInteractions(entityManager);
        verifyNoInteractions(schedules);
    }

    @Test
    void staleTemplateVersionFailsBeforeScheduleLocks() {
        optimisticTemplate.setVersion(5L);

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, request))
                .isInstanceOf(ScheduleBuildTemplateVersionConflictException.class);

        verifyNoInteractions(schedules, planner, lifecycle, entityManager);
        verify(templates, never()).findForUpdateByIdAndRestaurantId(any(), any());
        verify(templates, never()).saveAndFlush(any());
    }

    @Test
    void locksCanonicalDiscoveredIdsBeforeTemplateAndPlansOnlyAfterFinalLock() {
        Schedule first = schedule(30L, PREFERENCES_CLOSED);
        Schedule second = schedule(40L, COLLECTING_PREFERENCES);
        when(schedules.findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L))
                .thenReturn(List.of(40L, 30L, 40L), List.of(30L, 40L));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(30L, 40L)))
                .thenReturn(List.of(first, second));
        when(planner.plan(template, request, List.of(first, second))).thenReturn(plan(PLANNER_AFFECTING,
                impact(first, KEEP_PREFERENCES), impact(second, KEEP_PREFERENCES)));

        service.update(1L, 10L, 7L, request);

        InOrder order = inOrder(schedules, templates, planner);
        order.verify(templates).findByIdAndRestaurantId(10L, 1L);
        order.verify(schedules).findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L);
        order.verify(schedules).findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(30L, 40L));
        order.verify(templates).findForUpdateByIdAndRestaurantId(10L, 1L);
        order.verify(schedules).findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L);
        order.verify(planner).plan(template, request, List.of(first, second));
        verifyNoInteractions(lifecycle);
    }

    @Test
    void templateChangingAfterEarlyCheckIsCaughtByAuthoritativeCheck() {
        Schedule locked = schedule(30L, DRAFT);
        template.setVersion(5L);
        when(schedules.findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L))
                .thenReturn(List.of(30L));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(30L)))
                .thenReturn(List.of(locked));

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, request))
                .isInstanceOf(ScheduleBuildTemplateVersionConflictException.class);

        InOrder order = inOrder(schedules, templates);
        order.verify(templates).findByIdAndRestaurantId(10L, 1L);
        order.verify(schedules).findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L);
        order.verify(schedules).findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(30L));
        order.verify(templates).findForUpdateByIdAndRestaurantId(10L, 1L);
        verify(schedules, times(1))
                .findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L);
        verifyNoInteractions(planner, lifecycle);
        verifyOnlyOptimisticDetach();
        verify(templates, never()).saveAndFlush(any());
        assertThat(template.getName()).isEqualTo("Old");
    }

    @Test
    void exactLinkedSetMismatchAfterLocksAbortsBeforePlanningOrMutation() {
        Schedule locked = schedule(30L, DRAFT);
        when(schedules.findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L))
                .thenReturn(List.of(30L), List.of(30L, 40L));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(30L)))
                .thenReturn(List.of(locked));

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, request))
                .isInstanceOf(ru.staffly.schedule.exception.ScheduleDomainConflictException.class);

        verifyNoInteractions(planner, lifecycle);
        verifyOnlyOptimisticDetach();
        verify(templates, never()).saveAndFlush(any());
        assertThat(template.getName()).isEqualTo("Old");
    }

    @Test
    void lockedResultMismatchAbortsBeforePlanningOrMutation() {
        when(schedules.findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L))
                .thenReturn(List.of(30L));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(30L)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, request))
                .isInstanceOf(ru.staffly.schedule.exception.ScheduleDomainConflictException.class);

        verifyNoInteractions(planner, lifecycle);
        verifyOnlyOptimisticDetach();
        verify(templates, never()).saveAndFlush(any());
    }

    @Test
    void archiveIsRejectedWhileTemplateHasCollectingSchedule() {
        when(schedules.existsByPreferenceBuildTemplateIdAndStatus(10L, COLLECTING_PREFERENCES))
                .thenReturn(true);

        assertThatThrownBy(() -> service.archive(1L, 10L, 7L))
                .isInstanceOf(ru.staffly.schedule.exception.ScheduleDomainConflictException.class);

        assertThat(template.isActive()).isTrue();
        verify(templates, never()).save(any());
    }

    @Test
    void collectingScheduleStillUsesMatrixDrivenOrdinaryUpdate() {
        Schedule collecting = schedule(31L, COLLECTING_PREFERENCES);
        lock(List.of(31L), List.of(collecting));
        when(planner.plan(template, request, List.of(collecting))).thenReturn(plan(PLANNER_AFFECTING,
                impact(collecting, KEEP_PREFERENCES)));

        service.update(1L, 10L, 7L, request);

        verify(schedules, never()).existsByPreferenceBuildTemplateIdAndStatus(any(), any());
        verifyNoInteractions(lifecycle);
        verify(templates).saveAndFlush(template);
    }

    @Test
    void activeOnlyChangeIsAppliedWithoutLifecycleMutation() {
        SaveScheduleBuildTemplateRequest activeOnly = request("Old", false, false, 4L);
        when(planner.plan(template, activeOnly, List.of())).thenReturn(plan(NONE));

        service.update(1L, 10L, 7L, activeOnly);

        assertThat(template.isActive()).isFalse();
        verify(templates).saveAndFlush(template);
        verify(entityManager).detach(optimisticTemplate);
        verify(entityManager, never()).lock(any(), any());
        verifyNoInteractions(lifecycle);
    }

    @Test
    void malformedNoneEquivalentRequestCannotBypassValidation() {
        SaveScheduleBuildPositionConfigRequest config = request.positionConfigs().get(0);
        SaveScheduleBuildPositionConfigRequest malformedConfig = new SaveScheduleBuildPositionConfigRequest(
                List.of(2L, 2L), config.workPeriodStart(), config.workPeriodEnd(), config.targetPattern(),
                config.minRestHours(), config.minRestMode(), config.maxShiftsPerPeriod(), config.heavyDaysOfWeek(),
                config.shiftOptions(), config.coverageRules(), config.coverageDateOverrides(), config.sortOrder());
        SaveScheduleBuildTemplateRequest malformed = new SaveScheduleBuildTemplateRequest(
                "Old", null, true, List.of(malformedConfig), 4L, false);

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, malformed))
                .isInstanceOf(ru.staffly.common.exception.BadRequestException.class)
                .hasMessage("positionIds must not contain duplicates");

        verifyNoInteractions(planner, lifecycle, entityManager, schedules);
        verify(templates, never()).findForUpdateByIdAndRestaurantId(any(), any());
        verify(templates, never()).saveAndFlush(any());
    }

    @Test
    void failureDuringSecondInvalidationPropagatesBeforeTemplateMutation() {
        Schedule first = schedule(2L, COLLECTING_PREFERENCES);
        Schedule second = schedule(3L, PREFERENCES_CLOSED);
        SaveScheduleBuildTemplateRequest confirmed = request(true, 4L);
        lock(List.of(2L, 3L), List.of(first, second));
        when(planner.plan(template, confirmed, List.of(first, second))).thenReturn(plan(PREFERENCE_AFFECTING,
                impact(first, RESET_PREFERENCE_COLLECTION), impact(second, RESET_PREFERENCE_COLLECTION)));
        doThrow(new IllegalStateException("second reset failed")).when(lifecycle)
                .resetPreferenceCollectionWithLocksHeld(second, 7L, "Изменение шаблона сборки графика");

        assertThatThrownBy(() -> service.update(1L, 10L, 7L, confirmed))
                .isInstanceOf(IllegalStateException.class).hasMessage("second reset failed");

        verify(lifecycle).resetPreferenceCollectionWithLocksHeld(first, 7L, "Изменение шаблона сборки графика");
        verify(templates, never()).saveAndFlush(any());
        assertThat(template.getName()).isEqualTo("Old");
    }

    private void lock(List<Long> ids, List<Schedule> locked) {
        when(schedules.findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 10L)).thenReturn(ids);
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, ids)).thenReturn(locked);
    }

    private void verifyOnlyOptimisticDetach() {
        verify(entityManager).detach(optimisticTemplate);
        verifyNoMoreInteractions(entityManager);
    }

    private SaveScheduleBuildTemplateRequest request(boolean confirmed, Long version) {
        return request("New", true, confirmed, version);
    }

    private SaveScheduleBuildTemplateRequest request(String name, boolean active, boolean confirmed, Long version) {
        var shift = new SaveScheduleBuildShiftOptionRequest(LocalTime.of(9, 0), LocalTime.of(17, 0), null, 0);
        var config = new SaveScheduleBuildPositionConfigRequest(List.of(2L), LocalTime.of(9, 0),
                LocalTime.of(17, 0), null, null, null, null, List.of(), List.of(shift), List.of(), List.of(), 0);
        return new SaveScheduleBuildTemplateRequest(name, null, active, List.of(config), version, confirmed);
    }

    private ScheduleBuildTemplateImpactPlan plan(ScheduleBuildTemplateChangeImpact impact,
                                                  ScheduleBuildTemplateScheduleImpact... items) {
        return new ScheduleBuildTemplateImpactPlan(impact, List.of(items));
    }

    private ScheduleBuildTemplateScheduleImpact impact(Schedule schedule, ScheduleBuildTemplateScheduleAction action) {
        return new ScheduleBuildTemplateScheduleImpact(schedule.getId(), schedule.getTitle(), schedule.getStatus(), action);
    }

    private Schedule schedule(Long id, ScheduleStatus status) {
        return Schedule.builder().id(id).title("S" + id).status(status).build();
    }
}
