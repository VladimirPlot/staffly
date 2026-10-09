package ru.staffly.invite;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.exception.InvitationImpactPlanStaleException;
import ru.staffly.invite.mapper.InvitationMapper;
import ru.staffly.invite.model.*;
import ru.staffly.invite.repository.*;
import ru.staffly.invite.service.*;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class InvitationDeadlineContractTest {
    private static final Instant NOW = Instant.parse("2030-10-12T12:00:00Z");
    private static final Instant CURRENT = NOW.plusSeconds(3600);

    @ParameterizedTest
    @EnumSource(value = InvitationScheduleIntentAction.class, names = {
            "ADD_TO_COLLECTION", "ADD_AND_REOPEN_COLLECTION", "ADD_AND_REOPEN_FOR_REBUILD"})
    void deadlineActionsAcceptLaterAndEqualButRejectEarlierAndPast(InvitationScheduleIntentAction action) {
        assertDoesNotThrow(() -> new Fixture(action, CURRENT).invite(CURRENT.plusSeconds(3600), CURRENT));
        assertDoesNotThrow(() -> new Fixture(action, CURRENT).invite(CURRENT, CURRENT));
        var earlier = assertThrows(BadRequestException.class,
                () -> new Fixture(action, CURRENT).invite(NOW.plusSeconds(1800), CURRENT));
        assertEquals("Новый дедлайн не может быть раньше текущего.", earlier.getMessage());
        for (Instant deadline : List.of(NOW, NOW.minusSeconds(60))) {
            var past = assertThrows(BadRequestException.class,
                    () -> new Fixture(action, CURRENT).invite(deadline, CURRENT));
            assertEquals("Дата и время дедлайна должны быть в будущем.", past.getMessage());
        }
        assertDoesNotThrow(() -> new Fixture(action, null).invite(CURRENT, null));
        assertDoesNotThrow(() -> new Fixture(action, NOW.minusSeconds(60)).invite(CURRENT, NOW.minusSeconds(60)));
    }

    @ParameterizedTest
    @EnumSource(value = InvitationScheduleIntentAction.class, names = {
            "ADD_AND_REOPEN_COLLECTION", "ADD_AND_REOPEN_FOR_REBUILD"})
    void reopenRequiresDeadline(InvitationScheduleIntentAction action) {
        var error = assertThrows(BadRequestException.class,
                () -> new Fixture(action, CURRENT).invite(null, CURRENT));
        assertEquals("Укажите новый дедлайн для повторного открытия сбора пожеланий.", error.getMessage());
    }

    @Test void collectionExtensionIsOptional() {
        assertDoesNotThrow(() -> new Fixture(InvitationScheduleIntentAction.ADD_TO_COLLECTION, CURRENT).invite(null, CURRENT));
    }

    @ParameterizedTest
    @EnumSource(value = InvitationScheduleIntentAction.class, names = {
            "DO_NOT_ADD", "ADD_TO_DRAFT", "DO_NOT_ADD_TO_DRAFT", "INFORMATION_ONLY"})
    void otherActionsRejectUnexpectedDeadline(InvitationScheduleIntentAction action) {
        var error = assertThrows(BadRequestException.class,
                () -> new Fixture(action, CURRENT).invite(CURRENT, CURRENT));
        assertEquals("Для выбранного действия нельзя указывать дедлайн.", error.getMessage());
        assertDoesNotThrow(() -> new Fixture(action, CURRENT).invite(null, CURRENT));
    }

    @ParameterizedTest
    @EnumSource(value = InvitationScheduleIntentAction.class, names = {
            "ADD_TO_COLLECTION", "ADD_AND_REOPEN_COLLECTION", "ADD_AND_REOPEN_FOR_REBUILD"})
    void changedDeadlineRejectsPreviewBeforeDeadlineValidation(InvitationScheduleIntentAction action) {
        // Preview 18:00, requested 20:00, meanwhile another manager extended to 21:00.
        var fixture = new Fixture(action, CURRENT.plusSeconds(3 * 3600));
        var error = assertThrows(InvitationImpactPlanStaleException.class,
                () -> fixture.invite(CURRENT.plusSeconds(2 * 3600), CURRENT));
        assertEquals("INVITATION_IMPACT_PLAN_STALE", error.getMeta().get("code"));
        verify(fixture.invitations, never()).save(any());
        verify(fixture.intents, never()).save(any());
    }

    private static class Fixture {
        final InvitationRepository invitations = mock(InvitationRepository.class);
        final InvitationScheduleIntentRepository intents = mock(InvitationScheduleIntentRepository.class);
        final InvitationCommandService commands;
        final Schedule schedule;
        final InvitationScheduleIntentAction action;

        Fixture(InvitationScheduleIntentAction action, Instant current) {
            this.action = action;
            var status = switch (action) {
                case ADD_TO_COLLECTION, DO_NOT_ADD -> ScheduleStatus.COLLECTING_PREFERENCES;
                case ADD_AND_REOPEN_COLLECTION -> ScheduleStatus.PREFERENCES_CLOSED;
                case ADD_AND_REOPEN_FOR_REBUILD -> ScheduleStatus.DRAFT_FROM_PREFERENCES;
                case ADD_TO_DRAFT, DO_NOT_ADD_TO_DRAFT -> ScheduleStatus.DRAFT;
                case INFORMATION_ONLY -> ScheduleStatus.PUBLISHED;
            };
            var restaurant = Restaurant.builder().id(1L).build();
            var position = Position.builder().id(2L).restaurant(restaurant).build();
            schedule = Schedule.builder().id(10L).version(5L).restaurant(restaurant).status(status)
                    .preferenceDeadline(current).preferenceCollectionMode(PreferenceCollectionMode.DAY_LEVEL).build();
            var restaurants = mock(RestaurantRepository.class);
            var users = mock(UserRepository.class);
            var schedules = mock(ScheduleRepository.class);
            var positions = mock(PositionRepository.class);
            var impact = mock(InvitationImpactService.class);
            var time = mock(RestaurantTimeService.class);
            when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant));
            when(users.findById(7L)).thenReturn(Optional.of(User.builder().id(7L).build()));
            when(impact.validateCandidateIsNotMember(1L, "+79999999999")).thenReturn("+79999999999");
            when(positions.findForShareByIdAndRestaurantId(2L, 1L)).thenReturn(Optional.of(position));
            when(impact.validatePosition(1L, 2L, 7L)).thenReturn(position);
            when(time.nowInstant()).thenReturn(NOW);
            when(schedules.findByRestaurantIdAndPositionIdAndEndDateGreaterThanEqualOrderByIdAsc(eq(1L), eq(2L), any()))
                    .thenReturn(List.of(schedule));
            when(impact.opportunity(schedule, 2L, NOW)).thenReturn(
                    new InvitationImpactService(null, null, null, null, null, null, null).opportunity(schedule, 2L, NOW));
            when(invitations.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
            commands = new InvitationCommandService(invitations, restaurants, users, schedules, intents, impact, time,
                    new InvitationMapper(), mock(SecurityService.class), mock(InvitationSenderNotificationService.class),
                    mock(InvitationContactLock.class), positions);
        }

        void invite(Instant requested, Instant expected) {
            var decision = new InviteRequest.ScheduleDecision(10L, action, requested, 5L, schedule.getStatus(),
                    0, expected, PreferenceCollectionMode.DAY_LEVEL);
            commands.invite(1L, 7L, new InviteRequest("+79999999999", 2L, List.of(decision)));
            assertEquals(schedule.getStatus(), decision.expectedScheduleStatus());
            assertEquals(expected, schedule.getPreferenceDeadline());
        }
    }
}
