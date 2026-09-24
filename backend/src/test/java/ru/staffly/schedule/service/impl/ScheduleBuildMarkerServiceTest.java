package ru.staffly.schedule.service.impl;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import ru.staffly.schedule.model.ScheduleBuildPattern;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleBuildTemplateImpactPlanner;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.security.SecurityService;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleBuildMarkerServiceTest {
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

    @BeforeEach
    void setUp() {
        service = new ScheduleBuildTemplateServiceImpl(templates, schedules, restaurants, positions, members,
                security, access, planner, lifecycle, entityManager);
        restaurant = Restaurant.builder().id(1L).build();
        waiter = Position.builder().id(10L).name("Waiter").restaurant(restaurant).build();
        when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant));
        when(positions.findAllById(any())).thenReturn(List.of(waiter));
        when(templates.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void createsMarkerWithMultipleValidMembersAndReturnsCanonicalIds() {
        RestaurantMember first = member(2L, waiter);
        RestaurantMember second = member(1L, waiter);
        when(members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(1L, 2L)))
                .thenReturn(List.of(second, first));

        var dto = service.create(1L, 99L, request(List.of(
                new SaveScheduleBuildMarkerRequest("  Club  ", List.of(2L, 1L)))));

        assertThat(dto.positionConfigs().get(0).markers()).singleElement().satisfies(marker -> {
            assertThat(marker.name()).isEqualTo("Club");
            assertThat(marker.memberIds()).containsExactly(1L, 2L);
        });
    }

    @Test
    void allowsEmptyMembership() {
        assertThat(service.create(1L, 99L, request(List.of(
                new SaveScheduleBuildMarkerRequest("Club", List.of()))))
                .positionConfigs().get(0).markers().get(0).memberIds()).isEmpty();
    }

    @Test
    void rejectsCaseInsensitiveDuplicateNamesAndDuplicateMemberIds() {
        assertThatThrownBy(() -> service.create(1L, 99L, request(List.of(
                new SaveScheduleBuildMarkerRequest("Club", List.of()),
                new SaveScheduleBuildMarkerRequest("club", List.of())))))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.create(1L, 99L, request(List.of(
                new SaveScheduleBuildMarkerRequest("Club", List.of(1L, 1L))))))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsMemberWhoseCurrentPositionIsOutsideBlock() {
        Position cook = Position.builder().id(11L).restaurant(restaurant).build();
        when(members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(1L)))
                .thenReturn(List.of(member(1L, cook)));
        assertThatThrownBy(() -> service.create(1L, 99L, request(List.of(
                new SaveScheduleBuildMarkerRequest("Club", List.of(1L))))))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("current position");
    }

    private RestaurantMember member(Long id, Position position) {
        return RestaurantMember.builder().id(id).restaurant(restaurant).position(position).build();
    }

    private SaveScheduleBuildTemplateRequest request(List<SaveScheduleBuildMarkerRequest> markers) {
        var option = new SaveScheduleBuildShiftOptionRequest(LocalTime.of(9, 0), LocalTime.of(17, 0), null, 0);
        var regime = new SaveScheduleBuildWeekdayRegimeRequest(List.of(DayOfWeek.values()),
                LocalTime.of(9, 0), LocalTime.of(17, 0), List.of(option), List.of(), List.of(), 0);
        var config = new SaveScheduleBuildPositionConfigRequest(List.of(10L), ScheduleBuildPattern.NONE,
                12, null, 5, List.of(), List.of(regime), markers, 0);
        return new SaveScheduleBuildTemplateRequest("Template", null, true, List.of(config));
    }
}
