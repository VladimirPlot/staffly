package ru.staffly.reminder.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.reminder.dto.ReminderRequest;
import ru.staffly.reminder.mapper.ReminderMapper;
import ru.staffly.reminder.repository.ReminderRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReminderAudienceServiceTest {
    final ReminderRepository reminders = mock(ReminderRepository.class);
    final RestaurantRepository restaurants = mock(RestaurantRepository.class);
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final PositionRepository positions = mock(PositionRepository.class);
    final RestaurantTimeService time = mock(RestaurantTimeService.class);
    final ReminderServiceImpl service = new ReminderServiceImpl(reminders, restaurants, members, positions,
            new ReminderMapper(), mock(SecurityService.class), time, mock(RestaurantLifecycleMutex.class));
    Restaurant restaurant;
    RestaurantMember actor, first, second;
    Position firstPosition, secondPosition;

    @BeforeEach void setup() {
        restaurant = Restaurant.builder().id(1L).timezone("UTC").build();
        firstPosition = Position.builder().id(11L).restaurant(restaurant).name("Waiter").build();
        secondPosition = Position.builder().id(12L).restaurant(restaurant).name("Cook").build();
        actor = member(10L, Position.builder().id(13L).restaurant(restaurant).name("Manager").level(RestaurantRole.MANAGER).build());
        first = member(20L, firstPosition); second = member(30L, secondPosition);
        when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant));
        when(members.findActiveByUserIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(actor));
        for (var member : List.of(actor, first, second)) {
            when(members.findByIdAndEndedAtIsNull(member.getId())).thenReturn(Optional.of(member));
        }
        for (var position : List.of(firstPosition, secondPosition)) {
            when(positions.findById(position.getId())).thenReturn(Optional.of(position));
        }
        when(time.nowInstant()).thenReturn(Instant.parse("2026-10-10T12:00:00Z"));
        when(time.zoneFor(restaurant)).thenReturn(ZoneId.of("UTC"));
        when(reminders.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private RestaurantMember member(Long id, Position position) {
        return RestaurantMember.builder().id(id).restaurant(restaurant).position(position)
                .user(User.builder().id(id).firstName("Test").build()).build();
    }

    private ReminderRequest request(String type, List<Long> positionIds, List<Long> memberIds) {
        return new ReminderRequest("Test", null, false, type, null, null,
                "DAILY", "09:00", null, null, false, null, positionIds, memberIds);
    }

    @Test void createsMultiplePositionsAndDeduplicatesIds() {
        var dto = service.create(1L, 10L, request("POSITION", List.of(11L, 12L, 11L), List.of()));
        assertEquals(List.of(11L, 12L), dto.targetPositions().stream().map(p -> p.id()).toList());
        assertTrue(dto.targetMembers().isEmpty());
        assertNull(dto.targetPosition());
    }

    @Test void createsMultipleMembersAndUpdatesToAnotherAudience() {
        var dto = service.create(1L, 10L, request("MEMBER", List.of(11L, 12L), List.of(20L, 30L, 20L)));
        assertEquals(List.of(20L, 30L), dto.targetMembers().stream().map(m -> m.id()).toList());
        var saved = org.mockito.ArgumentCaptor.forClass(ru.staffly.reminder.model.Reminder.class);
        verify(reminders).save(saved.capture());
        when(reminders.findByIdAndRestaurantId(1L, 1L)).thenReturn(Optional.of(saved.getValue()));
        var updated = service.update(1L, 10L, 1L, request("POSITION", List.of(12L), List.of()));
        assertTrue(updated.targetMembers().isEmpty());
        assertEquals(12L, updated.targetPosition().id());
    }

    @Test void rejectsForeignRestaurantInactiveMembersAndPositionMismatch() {
        assertThrows(BadRequestException.class, () -> service.create(1L, 10L, request("MEMBER", List.of(11L), List.of(30L))));
        firstPosition.setRestaurant(Restaurant.builder().id(2L).build());
        assertThrows(BadRequestException.class, () -> service.create(1L, 10L, request("POSITION", List.of(11L), List.of())));
        second.setRestaurant(Restaurant.builder().id(2L).build());
        assertThrows(BadRequestException.class, () -> service.create(1L, 10L, request("MEMBER", List.of(), List.of(30L))));
        assertThrows(ru.staffly.common.exception.NotFoundException.class, () -> service.create(1L, 10L, request("MEMBER", List.of(), List.of(99L))));
    }

    @Test void staffCanOnlyCreatePrivateSelfReminder() {
        actor.setPosition(firstPosition);
        assertThrows(BadRequestException.class, () -> service.create(1L, 10L, request("MEMBER", List.of(), List.of(10L, 20L))));
        assertThrows(BadRequestException.class, () -> service.create(1L, 10L, request("POSITION", List.of(11L), List.of())));
        var dto = service.create(1L, 10L, request("MEMBER", List.of(), List.of()));
        assertEquals(10L, dto.targetMembers().get(0).id());
        assertFalse(dto.visibleToAdmin());
    }
}
