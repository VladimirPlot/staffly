package ru.staffly.member.service.impl;

import jakarta.transaction.Transactional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.invite.exception.InvitationInvalidatedException;
import ru.staffly.invite.exception.InvitationExpiredException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.mapper.InvitationMapper;
import ru.staffly.invite.model.*;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.invite.repository.InvitationScheduleIntentRepository;
import ru.staffly.invite.service.InvitationImpactService;
import ru.staffly.invite.service.InvitationAcceptanceOwnerNotificationService;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.schedule.dto.AppliedInvitationScheduleEffect;
import ru.staffly.security.SecurityService;
import ru.staffly.training.service.CertificationAudienceSyncService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

@ExtendWith(MockitoExtension.class)
class EmployeeServiceImplAcceptanceTest {
    private static final Instant NOW = Instant.parse("2026-09-21T12:00:00Z");
    @Mock InvitationRepository invitations;
    @Mock RestaurantMemberRepository members;
    @Mock RestaurantRepository restaurants;
    @Mock UserRepository users;
    @Mock ScheduleRepository schedules;
    @Mock InvitationScheduleIntentRepository intents;
    @Mock InvitationImpactService impactService;
    @Mock SchedulePreferenceLifecycleService lifecycle;
    @Mock RestaurantTimeService restaurantTime;
    @Mock InvitationMapper invitationMapper;
    @Mock MemberMapper memberMapper;
    @Mock SecurityService security;
    @Mock CertificationAudienceSyncService certificationSync;
    @Mock InvitationAcceptanceOwnerNotificationService ownerNotifications;
    @InjectMocks EmployeeServiceImpl service;

    private Restaurant restaurant;
    private Position position;
    private User user;
    private Invitation invitation;

    @BeforeEach
    void setUp() {
        TimeProvider.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        restaurant = Restaurant.builder().id(3L).build();
        position = Position.builder().id(5L).restaurant(restaurant).active(true).level(RestaurantRole.STAFF).build();
        user = User.builder().id(9L).phone("+79991112233").build();
        invitation = Invitation.builder().id(7L).token("token").restaurant(restaurant)
                .phoneOrEmail("+79991112233").status(InvitationStatus.PENDING)
                .expiresAt(NOW.plusSeconds(3600)).desiredRole(RestaurantRole.STAFF)
                .position(position).build();
        lenient().when(invitations.findForUpdateByToken("token")).thenReturn(Optional.of(invitation));
        lenient().when(users.findById(9L)).thenReturn(Optional.of(user));
        lenient().when(certificationSync.syncRestaurantAudience(3L, 9L)).thenReturn(List.of());
    }

    @AfterEach
    void resetClock() {
        TimeProvider.setClock(Clock.systemUTC());
    }

    @Test
    void allSnapshotsValidateBeforeMembershipAndAllAddIntentsApply() {
        Schedule first = schedule(11L, PreferenceCollectionMode.DAY_LEVEL);
        Schedule second = schedule(12L, PreferenceCollectionMode.DAY_LEVEL);
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(7L))
                .thenReturn(List.of(intent(first, InvitationScheduleIntentAction.ADD_TO_COLLECTION),
                        intent(second, InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION)));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(11L, 12L)))
                .thenReturn(List.of(first, second));
        when(members.save(any())).thenAnswer(call -> {
            RestaurantMember member = call.getArgument(0);
            member.setId(21L);
            return member;
        });
        when(lifecycle.addParticipantWithLocksHeld(any(), any(), eq(9L), anyString())).thenReturn(true);

        service.acceptInvite("token", 9L);

        verify(members).save(any(RestaurantMember.class));
        verify(lifecycle).addParticipantWithLocksHeld(eq(first), any(), eq(9L), anyString());
        verify(lifecycle).addParticipantWithLocksHeld(eq(second), any(), eq(9L), anyString());
        verify(certificationSync).syncRestaurantAudience(3L, 9L);
        ArgumentCaptor<List<AppliedInvitationScheduleEffect>> effects = ArgumentCaptor.forClass(List.class);
        verify(ownerNotifications).submit(any(), eq(user), effects.capture(), eq(List.of()));
        org.assertj.core.api.Assertions.assertThat(effects.getValue())
                .extracting(AppliedInvitationScheduleEffect::scheduleId)
                .containsExactly(11L, 12L);
        assertEquals(InvitationStatus.ACCEPTED, invitation.getStatus());
    }

    @Test
    void nonAddActionsNeverBecomeAppliedScheduleNotificationEffects() {
        Schedule first = schedule(11L, PreferenceCollectionMode.DAY_LEVEL);
        Schedule second = schedule(12L, PreferenceCollectionMode.DAY_LEVEL);
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(7L)).thenReturn(List.of(
                intent(first, InvitationScheduleIntentAction.DO_NOT_ADD),
                intent(second, InvitationScheduleIntentAction.INFORMATION_ONLY)));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(11L, 12L)))
                .thenReturn(List.of(first, second));
        when(members.save(any())).thenAnswer(call -> {
            RestaurantMember member = call.getArgument(0);
            member.setId(21L);
            return member;
        });

        service.acceptInvite("token", 9L);

        verifyNoInteractions(lifecycle);
        verify(ownerNotifications).submit(any(), eq(user), eq(List.of()), eq(List.of()));
    }

    @Test
    void oneStaleSnapshotInvalidatesWithoutAnyAcceptanceMutation() {
        Schedule first = schedule(11L, PreferenceCollectionMode.DAY_LEVEL);
        Schedule stale = schedule(12L, PreferenceCollectionMode.DAY_LEVEL);
        InvitationScheduleIntent staleIntent = intent(stale, InvitationScheduleIntentAction.DO_NOT_ADD);
        stale.setVersion(3L);
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(7L)).thenReturn(List.of(
                intent(first, InvitationScheduleIntentAction.ADD_TO_COLLECTION), staleIntent));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(11L, 12L)))
                .thenReturn(List.of(first, stale));

        assertInvalidatedWithoutMutation();
    }

    @Test
    void deletedScheduleInvalidatesEvenForInformationOnlyIntent() {
        Schedule deleted = schedule(11L, PreferenceCollectionMode.DAY_LEVEL);
        InvitationScheduleIntent intent = intent(deleted, InvitationScheduleIntentAction.INFORMATION_ONLY);
        intent.setSchedule(null);
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(7L)).thenReturn(List.of(intent));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(11L))).thenReturn(List.of());

        assertInvalidatedWithoutMutation();
    }

    @Test
    void inactivePositionInvalidatesBeforeSchedulesAreLocked() {
        position.setActive(false);
        assertInvalidatedWithoutMutation();
        verifyNoInteractions(schedules);
    }

    @Test
    void missingFrozenShiftOptionsInvalidatesWithoutParticipation() {
        Schedule schedule = schedule(11L, PreferenceCollectionMode.SHIFT_OPTIONS);
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(7L))
                .thenReturn(List.of(intent(schedule, InvitationScheduleIntentAction.ADD_TO_COLLECTION)));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(3L, List.of(11L)))
                .thenReturn(List.of(schedule));

        assertInvalidatedWithoutMutation();
    }

    @Test
    void terminalInvitationCannotBeAcceptedTwice() {
        invitation.setStatus(InvitationStatus.ACCEPTED);
        assertThrows(RuntimeException.class, () -> service.acceptInvite("token", 9L));
        verifyNoInteractions(members, lifecycle, certificationSync);
        verifyNoInteractions(ownerNotifications);
    }

    @Test
    void certificationSynchronizationFailurePreventsAcceptedAndOwnerNotificationCollection() {
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(7L)).thenReturn(List.of());
        when(members.save(any())).thenAnswer(call -> call.getArgument(0));
        when(certificationSync.syncRestaurantAudience(3L, 9L)).thenThrow(new RuntimeException("sync failed"));

        assertThrows(RuntimeException.class, () -> service.acceptInvite("token", 9L));

        assertEquals(InvitationStatus.PENDING, invitation.getStatus());
        verifyNoInteractions(ownerNotifications);
    }

    @Test
    void expiredInvitationCommitsTerminalOutcomeWithoutAcceptanceEffects() {
        invitation.setExpiresAt(NOW.minusSeconds(1));

        assertThrows(InvitationExpiredException.class, () -> service.acceptInvite("token", 9L));

        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
        verify(invitations).saveAndFlush(invitation);
        verifyNoInteractions(schedules, intents, lifecycle, certificationSync);
        verify(members, never()).save(any());
    }

    @Test
    void invitationExpiringExactlyNowCommitsExpiredWithoutAcceptanceEffects() {
        invitation.setExpiresAt(NOW);

        assertThrows(InvitationExpiredException.class, () -> service.acceptInvite("token", 9L));

        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
        verify(invitations).saveAndFlush(invitation);
        verifyNoInteractions(schedules, intents, lifecycle, certificationSync);
        verify(members, never()).save(any());
    }

    @Test
    void cancelExpiredPendingMaterializesExpiredInsteadOfCanceled() {
        invitation.setExpiresAt(NOW);

        assertThrows(InvitationExpiredException.class, () -> service.cancelInvite(3L, 9L, "token"));

        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
        verify(invitations).saveAndFlush(invitation);
    }

    @Test
    void reinviteMaterializesExpiredPendingBeforeCreatingReplacement() {
        invitation.setExpiresAt(NOW);
        when(restaurants.findById(3L)).thenReturn(Optional.of(restaurant));
        when(impactService.validateCandidateIsNotMember(3L, "+79991112233")).thenReturn("+79991112233");
        when(invitations.findPendingForUpdateByContact(3L, "+79991112233", InvitationStatus.PENDING))
                .thenReturn(Optional.of(invitation));
        when(impactService.validatePosition(3L, 5L, 9L)).thenReturn(position);
        when(restaurantTime.today(restaurant)).thenReturn(LocalDate.of(2026, 9, 21));
        when(schedules.findByRestaurantIdAndPositionIdAndEndDateGreaterThanEqualOrderByIdAsc(anyLong(), anyLong(), any()))
                .thenReturn(List.of());
        when(invitations.save(any(Invitation.class))).thenAnswer(call -> call.getArgument(0));

        service.invite(3L, 9L, new InviteRequest("+79991112233", 5L, List.of()));

        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
        verify(invitations).saveAndFlush(invitation);
        verify(invitations).save(argThat(created -> created != invitation
                && created.getStatus() == InvitationStatus.PENDING
                && created.getExpiresAt().equals(NOW.plusSeconds(48 * 60 * 60))));
    }

    @Test
    void activePendingStillRejectsDuplicateInvitation() {
        when(restaurants.findById(3L)).thenReturn(Optional.of(restaurant));
        when(impactService.validateCandidateIsNotMember(3L, "+79991112233")).thenReturn("+79991112233");
        when(invitations.findPendingForUpdateByContact(3L, "+79991112233", InvitationStatus.PENDING))
                .thenReturn(Optional.of(invitation));

        assertThrows(ConflictException.class,
                () -> service.invite(3L, 9L, new InviteRequest("+79991112233", 5L, List.of())));

        verify(invitations, never()).save(any());
    }

    @Test
    void onlyExplicitTerminalOutcomesAreExcludedFromAcceptanceRollback() throws Exception {
        Transactional transaction = EmployeeServiceImpl.class
                .getMethod("acceptInvite", String.class, Long.class)
                .getAnnotation(Transactional.class);

        org.assertj.core.api.Assertions.assertThat(transaction.dontRollbackOn())
                .containsExactlyInAnyOrder(InvitationInvalidatedException.class, InvitationExpiredException.class);
    }

    private void assertInvalidatedWithoutMutation() {
        assertThrows(InvitationInvalidatedException.class, () -> service.acceptInvite("token", 9L));
        assertEquals(InvitationStatus.INVALIDATED, invitation.getStatus());
        verify(invitations).saveAndFlush(invitation);
        verify(members, never()).save(any());
        verifyNoInteractions(lifecycle, certificationSync);
    }

    private Schedule schedule(Long id, PreferenceCollectionMode mode) {
        return Schedule.builder().id(id).version(2L).restaurant(restaurant)
                .positions(new LinkedHashSet<>(List.of(position)))
                .status(ScheduleStatus.COLLECTING_PREFERENCES).preferenceCollectionCycle(4L)
                .preferenceDeadline(Instant.parse("2099-09-21T16:00:00Z"))
                .preferenceCollectionMode(mode).build();
    }

    private InvitationScheduleIntent intent(Schedule schedule, InvitationScheduleIntentAction action) {
        return InvitationScheduleIntent.builder().invitation(invitation).schedule(schedule)
                .expectedScheduleId(schedule.getId()).selectedAction(action)
                .expectedScheduleVersion(2L).expectedScheduleStatus(ScheduleStatus.COLLECTING_PREFERENCES)
                .expectedCollectionCycle(4L).expectedPreferenceDeadline(schedule.getPreferenceDeadline())
                .expectedPreferenceMode(schedule.getPreferenceCollectionMode()).build();
    }
}
