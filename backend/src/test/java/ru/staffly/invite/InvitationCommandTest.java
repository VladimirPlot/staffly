package ru.staffly.invite;
import org.junit.jupiter.api.Test;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.invite.dto.*;
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
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InvitationCommandTest {
    @Test void replacementPersistsFuturePlanWithoutScheduleWriteOrLock() {
        var invitations = mock(InvitationRepository.class); var restaurants = mock(RestaurantRepository.class);
        var users = mock(UserRepository.class); var schedules = mock(ScheduleRepository.class);
        var intents = mock(InvitationScheduleIntentRepository.class); var positions = mock(PositionRepository.class);
        var impact = mock(InvitationImpactService.class); var time = mock(RestaurantTimeService.class);
        var contactLock = mock(InvitationContactLock.class);
        var restaurant = Restaurant.builder().id(1L).build(); var position = Position.builder().id(2L).restaurant(restaurant).build();
        var now = Instant.now(); var deadline = now.plusSeconds(3600);
        var schedule = spy(Schedule.builder().id(10L).version(5L).title("Test").restaurant(restaurant)
                .status(ScheduleStatus.PREFERENCES_CLOSED).preferenceCollectionMode(PreferenceCollectionMode.DAY_LEVEL).build());
        var decision = new InviteRequest.ScheduleDecision(10L, InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION,
                deadline, 5L, ScheduleStatus.PREFERENCES_CLOSED, 0, null, PreferenceCollectionMode.DAY_LEVEL);
        var old = Invitation.builder().status(InvitationStatus.PENDING).expiresAt(now.plusSeconds(7200)).build();
        var saved = new ArrayList<Invitation>();
        when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant)); when(users.findById(7L)).thenReturn(Optional.of(User.builder().id(7L).build()));
        when(impact.validateCandidateIsNotMember(1L, "+79999999999")).thenReturn("+79999999999");
        when(positions.findForShareByIdAndRestaurantId(2L, 1L)).thenReturn(Optional.of(position));
        when(impact.validatePosition(1L, 2L, 7L)).thenReturn(position);
        when(time.nowInstant()).thenReturn(now);
        when(invitations.findPendingForUpdateByContact(1L, "+79999999999", InvitationStatus.PENDING)).thenReturn(Optional.of(old));
        when(schedules.findByRestaurantIdAndPositionIdAndEndDateGreaterThanEqualOrderByIdAsc(eq(1L), eq(2L), any())).thenReturn(List.of(schedule));
        var opportunity = new InvitationImpactService(null,null,null,null,null,null,null).opportunity(schedule,2L,now);
        when(impact.opportunity(schedule, 2L, now)).thenReturn(opportunity);
        when(invitations.save(any())).thenAnswer(a -> { Invitation inv = a.getArgument(0); saved.add(inv); return inv; });
        var commands = new InvitationCommandService(invitations, restaurants, users, schedules, intents, impact, time,
                new InvitationMapper(), mock(SecurityService.class), mock(InvitationSenderNotificationService.class), contactLock, positions);
        commands.invite(1L, 7L, new InviteRequest("+79999999999", 2L, List.of(decision)));
        assertEquals(InvitationStatus.SUPERSEDED, old.getStatus());
        assertEquals(1, saved.stream().filter(i -> i.getStatus() == InvitationStatus.PENDING).count());
        assertNotNull(saved.get(0).getPositionSnapshot());
        assertEquals(ScheduleStatus.PREFERENCES_CLOSED, schedule.getStatus()); assertNull(schedule.getPreferenceDeadline());
        verify(schedule, never()).setStatus(any()); verify(schedule, never()).setPreferenceDeadline(any());
        verify(schedules, never()).findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(any(), any());
        verify(schedules, never()).save(any());
        var order = inOrder(contactLock, invitations);
        order.verify(contactLock).lock(1L, "+79999999999");
        order.verify(invitations).findPendingForUpdateByContact(1L, "+79999999999", InvitationStatus.PENDING);
        order.verify(invitations).saveAndFlush(old); order.verify(invitations).save(any());
    }
}
