package ru.staffly.schedule.service.impl;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.*;
import ru.staffly.security.SecurityService;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ScheduleBuildMarkerCorrelationTest {
    @Mock ScheduleBuildTemplateRepository templates;
    @Mock ScheduleRepository schedules;
    @Mock RestaurantRepository restaurants;
    @Mock PositionRepository positions;
    @Mock RestaurantMemberRepository members;
    @Mock SecurityService security;
    @Mock ScheduleAccessService access;
    @Mock ScheduleBuildTemplateImpactPlanner planner;
    @Mock SchedulePreferenceLifecycleService lifecycle;
    @Mock EntityManager entityManager;

    private ScheduleBuildTemplateServiceImpl service;
    private Restaurant restaurant;
    private Position waiter;
    private Position seniorWaiter;
    private Position cook;
    private final Map<Long, Position> positionById = new HashMap<>();
    private final Map<Long, RestaurantMember> memberById = new HashMap<>();

    @BeforeEach
    void setUp() {
        service = new ScheduleBuildTemplateServiceImpl(templates, schedules, restaurants, positions, members,
                security, access, planner, lifecycle, entityManager);
        restaurant = Restaurant.builder().id(1L).build();
        waiter = position(10L, "Waiter");
        seniorWaiter = position(11L, "Senior waiter");
        cook = position(12L, "Cook");
        lenient().when(positions.findAllById(any())).thenAnswer(invocation -> StreamSupport.stream(
                        ((Iterable<Long>) invocation.getArgument(0)).spliterator(), false)
                .map(positionById::get).filter(Objects::nonNull).toList());
        lenient().when(members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(eq(1L), any()))
                .thenAnswer(invocation -> ((List<Long>) invocation.getArgument(1)).stream()
                        .map(memberById::get).filter(Objects::nonNull).toList());
        ScheduleBuildTemplateChangeClassifier classifier = new ScheduleBuildTemplateChangeClassifier();
        lenient().when(planner.plan(any(), any(), any())).thenAnswer(invocation ->
                new ScheduleBuildTemplateImpactPlan(classifier.classify(
                        invocation.getArgument(0), invocation.getArgument(1)), List.of()));
        lenient().when(templates.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void keepsConfigAndMarkerIdentityWhileShrinkingScopeRenamingAndCleaningStaleMember() {
        RestaurantMember ivan = member(100L, waiter);
        RestaurantMember petr = member(101L, seniorWaiter);
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter, seniorWaiter),
                marker(42L, "Клуб", ivan, petr)));
        arrangeUpdate(locked);

        ScheduleBuildPositionConfig existingConfig = locked.getPositionConfigs().get(0);
        ScheduleBuildMarker existingMarker = existingConfig.getMarkers().get(0);
        service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Ночной клуб", 100L, 101L))));

        assertThat(locked.getPositionConfigs()).singleElement().isSameAs(existingConfig);
        assertThat(existingConfig.getId()).isEqualTo(15L);
        assertThat(existingConfig.getPositions()).extracting(Position::getId).containsExactly(10L);
        assertThat(existingConfig.getMarkers()).singleElement().isSameAs(existingMarker);
        assertThat(existingMarker.getId()).isEqualTo(42L);
        assertThat(existingMarker.getName()).isEqualTo("Ночной клуб");
        assertThat(existingMarker.getMembers()).extracting(RestaurantMember::getId).containsExactly(100L);
    }

    @Test
    void staleCleanupCanLeaveExistingMarkerEmpty() {
        RestaurantMember petr = member(101L, seniorWaiter);
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter, seniorWaiter), marker(42L, "Клуб", petr)));
        arrangeUpdate(locked);
        ScheduleBuildMarker existing = locked.getPositionConfigs().get(0).getMarkers().get(0);

        service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Клуб", 101L))));

        assertThat(locked.getPositionConfigs().get(0).getMarkers()).singleElement().isSameAs(existing);
        assertThat(existing.getMembers()).isEmpty();
    }

    @Test
    void staleCleanupWithOtherwiseIdenticalRequestIsPersistedForUnusedMarker() {
        RestaurantMember ivan = member(100L, cook);
        ScheduleBuildPositionConfig config = config(15L, List.of(waiter), marker(42L, "Клуб", ivan));
        addRegime(config, null);
        ScheduleBuildTemplate locked = template(config);
        arrangeUpdate(locked);

        service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L), (Integer) null,
                markerRequest(42L, "Клуб", 100L))));

        assertThat(config.getMarkers().get(0).getMembers()).isEmpty();
        verify(planner).plan(eq(locked), argThat(proposed -> proposed.positionConfigs().get(0)
                .markers().get(0).memberIds().isEmpty()), eq(List.of()));
        verify(templates).saveAndFlush(locked);
        verify(entityManager).lock(locked, jakarta.persistence.LockModeType.PESSIMISTIC_FORCE_INCREMENT);
    }

    @Test
    void staleCleanupWithOtherwiseIdenticalRequestIsPersistedForAttachedMarker() {
        RestaurantMember ivan = member(100L, cook);
        ScheduleBuildPositionConfig config = config(15L, List.of(waiter), marker(42L, "Клуб", ivan));
        addRegime(config, 0);
        ScheduleBuildTemplate locked = template(config);
        arrangeUpdate(locked);

        service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L), 0,
                markerRequest(42L, "Клуб", 100L))));

        assertThat(config.getMarkers().get(0).getMembers()).isEmpty();
        assertThat(config.getWeekdayRegimes().get(0).getShiftOptions().get(0).getMarker()).isSameAs(config.getMarkers().get(0));
        verify(templates).saveAndFlush(locked);
    }

    @Test
    void switchesReferenceBetweenMarkersWithEqualMembers() {
        RestaurantMember ivan = member(100L, waiter);
        assertEquivalentMarkerReferenceSwitchIsPersisted(ivan);
    }

    @Test
    void switchesReferenceBetweenEmptyMarkers() {
        assertEquivalentMarkerReferenceSwitchIsPersisted();
    }

    @Test
    void identicalValidRequestRemainsNoOp() {
        RestaurantMember ivan = member(100L, waiter);
        ScheduleBuildPositionConfig config = config(15L, List.of(waiter), marker(42L, "Клуб", ivan));
        addRegime(config, 0);
        ScheduleBuildTemplate locked = template(config);
        arrangeUpdate(locked);

        service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L), 0,
                markerRequest(42L, "Клуб", 100L))));

        verify(templates, never()).saveAndFlush(any());
        verify(entityManager, never()).lock(eq(locked), any());
    }

    @Test
    void rejectsNewInvalidMemberWithoutMutatingExistingMarker() {
        RestaurantMember ivan = member(100L, waiter);
        member(102L, cook);
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter), marker(42L, "Клуб", ivan)));
        arrangeUpdate(locked);
        ScheduleBuildMarker existing = locked.getPositionConfigs().get(0).getMarkers().get(0);

        assertThatThrownBy(() -> service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Переименованный", 100L, 102L)))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("current position");
        assertThat(existing.getName()).isEqualTo("Клуб");
        assertThat(existing.getMembers()).extracting(RestaurantMember::getId).containsExactly(100L);
    }

    @Test
    void membershipInAnotherMarkerDoesNotMakeInvalidMemberStaleForRequestedMarker() {
        RestaurantMember ivan = member(100L, waiter);
        RestaurantMember sergey = member(102L, cook);
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter),
                marker(42L, "Клуб", ivan), marker(43L, "Банкет", sergey)));
        arrangeUpdate(locked);

        assertThatThrownBy(() -> service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Клуб", 100L, 102L), markerRequest(43L, "Банкет", 102L)))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("current position");
    }

    @Test
    void rejectsMarkerOwnedByAnotherPositionConfig() {
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter), marker(42L, "Клуб")),
                config(16L, List.of(seniorWaiter), marker(43L, "Банкет")));
        arrangeUpdate(locked);

        assertThatThrownBy(() -> service.update(1L, 1L, 9L, request(
                configRequest(15L, List.of(10L), markerRequest(43L, "Банкет")),
                configRequest(16L, List.of(11L), markerRequest(42L, "Клуб")))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("does not belong to positionConfig");
    }

    @Test
    void rejectsForeignPositionConfigIdAndDuplicateCorrelationIds() {
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter), marker(42L, "Клуб")));
        arrangeUpdate(locked);
        assertThatThrownBy(() -> service.update(1L, 1L, 9L,
                request(configRequest(999L, List.of(10L), markerRequest(null, "Новый")))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("does not belong to template");

        arrangeUpdate(locked);
        assertThatThrownBy(() -> service.update(1L, 1L, 9L, request(
                configRequest(15L, List.of(10L), markerRequest(42L, "Клуб")),
                configRequest(15L, List.of(11L), markerRequest(null, "Другой")))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Duplicate positionConfig id");

        arrangeUpdate(locked);
        assertThatThrownBy(() -> service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Клуб"), markerRequest(42L, "Дубликат")))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Duplicate marker id");
    }

    @Test
    void nullIdsAlwaysCreateNewConfigAndMarkerInsteadOfMatchingBySemantics() {
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter), marker(42L, "Клуб")));
        arrangeUpdate(locked);
        ScheduleBuildPositionConfig oldConfig = locked.getPositionConfigs().get(0);
        ScheduleBuildMarker oldMarker = oldConfig.getMarkers().get(0);

        service.update(1L, 1L, 9L,
                request(configRequest(null, List.of(10L), markerRequest(null, "Новый клуб"))));

        ScheduleBuildPositionConfig replacement = locked.getPositionConfigs().get(0);
        assertThat(replacement).isNotSameAs(oldConfig);
        assertThat(replacement.getId()).isNull();
        assertThat(replacement.getMarkers()).singleElement().satisfies(marker -> {
            assertThat(marker.getId()).isNull();
            assertThat(marker.getName()).isEqualTo("Новый клуб");
            assertThat(marker).isNotSameAs(oldMarker);
        });
    }

    @Test
    void acceptsValidNewMember() {
        RestaurantMember ivan = member(100L, waiter);
        member(103L, waiter);
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter), marker(42L, "Клуб", ivan)));
        arrangeUpdate(locked);

        service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Клуб", 100L, 103L))));

        assertThat(locked.getPositionConfigs().get(0).getMarkers().get(0).getMembers())
                .extracting(RestaurantMember::getId).containsExactly(100L, 103L);
    }

    @Test
    void missingOrOtherRestaurantMemberFailsBeforeScheduleAndTemplateLocks() {
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter), marker(42L, "Клуб")));
        arrangeUpdate(locked);

        assertThatThrownBy(() -> service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Клуб", 404L)))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("exist and belong to restaurant");
        verify(schedules, never()).findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(any(), any());
        verify(templates, never()).findForUpdateByIdAndRestaurantId(any(), any());

        clearInvocations(schedules, templates);
        Restaurant other = Restaurant.builder().id(2L).build();
        memberById.put(405L, RestaurantMember.builder().id(405L).restaurant(other).position(waiter).build());
        // The restaurant-scoped repository query must not return this row.
        when(members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(405L))).thenReturn(List.of());
        arrangeUpdate(locked);
        assertThatThrownBy(() -> service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Клуб", 405L)))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("exist and belong to restaurant");
        verify(templates, never()).findForUpdateByIdAndRestaurantId(any(), any());
    }

    @Test
    void locksCanonicalMembersBeforeSchedulesAndFinalTemplate() {
        RestaurantMember first = member(100L, waiter);
        RestaurantMember second = member(101L, waiter);
        ScheduleBuildTemplate locked = template(config(15L, List.of(waiter), marker(42L, "Клуб", first, second)));
        arrangeUpdate(locked);
        Schedule schedule = Schedule.builder().id(20L).title("S").status(ScheduleStatus.DRAFT).build();
        when(schedules.findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(1L, 1L))
                .thenReturn(List.of(20L), List.of(20L));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(20L)))
                .thenReturn(List.of(schedule));

        service.update(1L, 1L, 9L, request(configRequest(15L, List.of(10L),
                markerRequest(42L, "Клуб", 101L, 100L))));

        InOrder order = inOrder(members, schedules, templates);
        order.verify(members).findForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(100L, 101L));
        order.verify(schedules).findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(20L));
        order.verify(templates).findForUpdateByIdAndRestaurantId(1L, 1L);
    }

    private void arrangeUpdate(ScheduleBuildTemplate locked) {
        ScheduleBuildTemplate optimistic = copy(locked);
        lenient().when(templates.findByIdAndRestaurantId(1L, 1L)).thenReturn(Optional.of(optimistic));
        lenient().when(templates.findForUpdateByIdAndRestaurantId(1L, 1L)).thenReturn(Optional.of(locked));
    }

    private SaveScheduleBuildTemplateRequest request(SaveScheduleBuildPositionConfigRequest... configs) {
        return new SaveScheduleBuildTemplateRequest("Template", null, true, List.of(configs), 1L, false);
    }

    private SaveScheduleBuildPositionConfigRequest configRequest(Long id, List<Long> positionIds,
                                                                  SaveScheduleBuildMarkerRequest... markers) {
        return configRequest(id, positionIds, null, markers);
    }

    private SaveScheduleBuildPositionConfigRequest configRequest(Long id, List<Long> positionIds,
                                                                  Integer markerIndex,
                                                                  SaveScheduleBuildMarkerRequest... markers) {
        var shift = new SaveScheduleBuildShiftOptionRequest(
                LocalTime.of(9, 0), LocalTime.of(17, 0), null, 0, markerIndex);
        var regime = new SaveScheduleBuildWeekdayRegimeRequest(List.of(DayOfWeek.values()),
                LocalTime.of(9, 0), LocalTime.of(17, 0), List.of(shift), List.of(), List.of(), 0);
        return new SaveScheduleBuildPositionConfigRequest(id, positionIds, ScheduleBuildPattern.NONE,
                12, ScheduleBuildMinRestMode.SOFT, 5, List.of(), List.of(regime), List.of(markers), 0);
    }

    private SaveScheduleBuildMarkerRequest markerRequest(Long id, String name, Long... memberIds) {
        return new SaveScheduleBuildMarkerRequest(id, name, List.of(memberIds));
    }

    private Position position(Long id, String name) {
        Position value = Position.builder().id(id).name(name).restaurant(restaurant).build();
        positionById.put(id, value);
        return value;
    }

    private RestaurantMember member(Long id, Position position) {
        RestaurantMember value = RestaurantMember.builder().id(id).restaurant(restaurant).position(position).build();
        memberById.put(id, value);
        return value;
    }

    private ScheduleBuildMarker marker(Long id, String name, RestaurantMember... members) {
        return ScheduleBuildMarker.builder().id(id).name(name)
                .members(new LinkedHashSet<>(List.of(members))).build();
    }

    private ScheduleBuildPositionConfig config(Long id, List<Position> positions, ScheduleBuildMarker... markers) {
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder().id(id)
                .positions(new LinkedHashSet<>(positions)).targetPattern(ScheduleBuildPattern.NONE)
                .minRestHours(12).minRestMode(ScheduleBuildMinRestMode.SOFT).maxShiftsPerPeriod(5)
                .markers(new ArrayList<>(List.of(markers))).sortOrder(0).build();
        config.getMarkers().forEach(marker -> marker.setPositionConfig(config));
        return config;
    }

    private void addRegime(ScheduleBuildPositionConfig config, Integer markerIndex) {
        ScheduleBuildWeekdayRegime regime = ScheduleBuildWeekdayRegime.builder()
                .positionConfig(config).daysOfWeek(EnumSet.allOf(DayOfWeek.class))
                .workPeriodStart(LocalTime.of(9, 0)).workPeriodEnd(LocalTime.of(17, 0)).sortOrder(0).build();
        ScheduleBuildShiftOption shift = ScheduleBuildShiftOption.builder().weekdayRegime(regime)
                .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(17, 0)).sortOrder(0)
                .marker(markerIndex == null ? null : config.getMarkers().get(markerIndex)).build();
        regime.getShiftOptions().add(shift);
        config.getWeekdayRegimes().add(regime);
    }

    private void assertEquivalentMarkerReferenceSwitchIsPersisted(RestaurantMember... markerMembers) {
        ScheduleBuildPositionConfig config = config(15L, List.of(waiter),
                marker(42L, "Клуб", markerMembers), marker(43L, "Банкет", markerMembers));
        addRegime(config, 0);
        ScheduleBuildTemplate locked = template(config);
        arrangeUpdate(locked);

        ScheduleBuildTemplateDto response = service.update(1L, 1L, 9L,
                request(configRequest(15L, List.of(10L), 1,
                        markerRequest(42L, "Клуб", Arrays.stream(markerMembers).map(RestaurantMember::getId).toArray(Long[]::new)),
                        markerRequest(43L, "Банкет", Arrays.stream(markerMembers).map(RestaurantMember::getId).toArray(Long[]::new)))));

        assertThat(config.getWeekdayRegimes().get(0).getShiftOptions().get(0).getMarker().getId()).isEqualTo(43L);
        assertThat(response.positionConfigs().get(0).weekdayRegimes().get(0).shiftOptions().get(0).markerId())
                .isEqualTo(43L);
        when(templates.findByIdAndRestaurantId(1L, 1L)).thenReturn(Optional.of(locked));
        ScheduleBuildTemplateDto reread = service.get(1L, 1L, 9L);
        assertThat(reread.positionConfigs().get(0).weekdayRegimes().get(0).shiftOptions().get(0).markerId())
                .isEqualTo(43L);
        verify(templates).saveAndFlush(locked);
        verify(entityManager).lock(locked, jakarta.persistence.LockModeType.PESSIMISTIC_FORCE_INCREMENT);
    }

    private ScheduleBuildTemplate template(ScheduleBuildPositionConfig... configs) {
        ScheduleBuildTemplate value = ScheduleBuildTemplate.builder().id(1L).version(1L).restaurant(restaurant)
                .name("Template").isActive(true).positionConfigs(new ArrayList<>(List.of(configs))).build();
        value.getPositionConfigs().forEach(config -> config.setTemplate(value));
        return value;
    }

    private ScheduleBuildTemplate copy(ScheduleBuildTemplate source) {
        return template(source.getPositionConfigs().stream().map(config -> config(config.getId(),
                new ArrayList<>(config.getPositions()), config.getMarkers().stream().map(marker -> marker(marker.getId(),
                        marker.getName(), marker.getMembers().toArray(RestaurantMember[]::new)))
                        .toArray(ScheduleBuildMarker[]::new))).toArray(ScheduleBuildPositionConfig[]::new));
    }
}
