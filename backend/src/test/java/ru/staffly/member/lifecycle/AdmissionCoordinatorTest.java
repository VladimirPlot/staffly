package ru.staffly.member.lifecycle;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.aop.framework.ProxyFactory;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.interceptor.TransactionInterceptor;
import org.springframework.transaction.support.*;
import org.springframework.transaction.TransactionDefinition;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.invite.model.*;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.invite.exception.*;
import ru.staffly.invite.service.*;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.task.model.Task;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdmissionCoordinatorTest {
    @Test void duplicateAdmissionModulesFailBeforeStartup() {
        var first = mock(AdmissionLifecycleHandler.class);
        var second = mock(AdmissionLifecycleHandler.class);
        when(first.module()).thenReturn(LifecycleModule.SCHEDULE);
        when(second.module()).thenReturn(LifecycleModule.SCHEDULE);
        assertThrows(IllegalStateException.class,
                () -> coordinator(List.of(first, second)).validateUniqueHandlers());
    }

    final InvitationRepository invites = mock(InvitationRepository.class);
    final PositionRepository positions = mock(PositionRepository.class);
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final RestaurantTimeService time = mock(RestaurantTimeService.class);
    final RestaurantLifecycleMutex mutex = mock(RestaurantLifecycleMutex.class);
    final InvitationContactLock contactLock = mock(InvitationContactLock.class);
    final InvitationSenderNotificationService sender = mock(InvitationSenderNotificationService.class);
    final InvitationAcceptanceOwnerNotificationService owners = mock(InvitationAcceptanceOwnerNotificationService.class);
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final User user = User.builder().id(7L).phone("+79999999999").build();
    final Position position = Position.builder().id(2L).name("Waiter").restaurant(restaurant).build();
    final Instant now = Instant.parse("2026-10-05T12:00:00Z");
    final Invitation invite = invitation("token");
    final RecordingTx tx = new RecordingTx();
    Invitation invitation(String token) {
        return Invitation.builder().id(1L).token(token).restaurant(restaurant).phoneOrEmail(user.getPhone())
                .position(position).positionSnapshot(AdmissionPositionSnapshot.of(position))
                .status(InvitationStatus.PENDING).expiresAt(now.plusSeconds(3600)).build();
    }
    AdmissionCoordinator coordinator(List<AdmissionLifecycleHandler> handlers) {
        when(invites.findAdmissionIdentityByToken(anyString())).thenAnswer(a -> Optional.of(
                new InvitationRepository.AdmissionIdentity() {
                    public Long getRestaurantId() { return 1L; }
                    public String getContact() { return invite.getPhoneOrEmail(); }
                }));
        when(invites.findForUpdateByToken("token")).thenReturn(Optional.of(invite));
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(positions.findForShareByIdAndRestaurantId(2L, 1L)).thenReturn(Optional.of(position));
        when(time.nowInstant()).thenReturn(now);
        when(members.save(any())).thenAnswer(a -> { RestaurantMember m = a.getArgument(0); m.setId(42L); return m; });
        var target = new AdmissionCoordinator(handlers, mutex, contactLock, invites, positions, members, users,
                new MemberMapper(), time, sender, owners);
        var proxy = new ProxyFactory(target);
        proxy.setProxyTargetClass(true);
        proxy.addAdvice(new TransactionInterceptor(tx, new AnnotationTransactionAttributeSource()));
        return (AdmissionCoordinator) proxy.getProxy();
    }
    @Test void rehireCreatesNewPeriodAndNeverRetargetsHistoricalTask() {
        var old = RestaurantMember.builder().id(17L).user(user).restaurant(restaurant).position(position)
                .startedAt(now.minusSeconds(10000)).endedAt(now.minusSeconds(5000)).build();
        var task = spy(Task.builder().assignedMember(old).setterMember(old).build());
        var result = coordinator(List.of()).acceptInvite("token", 7L);
        assertEquals(42L, result.id());
        assertEquals(now, invite.getAcceptedMember().getStartedAt());
        assertEquals(InvitationStatus.ACCEPTED, invite.getStatus());
        assertEquals(now.minusSeconds(5000), old.getEndedAt());
        assertSame(old, task.getAssignedMember());
        assertSame(old, task.getSetterMember());
        verify(task, never()).setAssignedMember(any());
        verify(task, never()).setSetterMember(any());
        var order = inOrder(mutex, contactLock, invites, members);
        order.verify(invites).findAdmissionIdentityByToken("token");
        order.verify(mutex).lock(1L);
        order.verify(contactLock).lock(1L, user.getPhone());
        order.verify(invites).findForUpdateByToken("token");
        order.verify(members).existsByRestaurantIdAndUserIdAndEndedAtIsNull(1L, 7L);
        order.verify(members).save(any());
        assertEquals(1, tx.commits.get());
    }
    @Test void changedPositionInvalidatesAndCommitsWithoutMember() {
        position.setLevel(RestaurantRole.ADMIN);
        assertThrows(InvitationInvalidatedException.class, () -> coordinator(List.of()).acceptInvite("token", 7L));
        assertEquals(InvitationStatus.INVALIDATED, invite.getStatus());
        verify(members, never()).save(any());
        assertEquals(1, tx.commits.get());
        assertEquals(0, tx.rollbacks.get());
    }
    @Test void allModulesPrepareBeforeMemberAndTechnicalApplyFailureRollsBack() {
        var schedule = mock(AdmissionLifecycleHandler.class);
        var certification = mock(AdmissionLifecycleHandler.class);
        when(schedule.getOrder()).thenReturn(100); when(certification.getOrder()).thenReturn(200);
        var scheduleApply = mock(AdmissionLifecycleHandler.PreparedAdmission.class);
        var certificationApply = mock(AdmissionLifecycleHandler.PreparedAdmission.class);
        when(schedule.prepare(any())).thenReturn(scheduleApply);
        when(certification.prepare(any())).thenReturn(certificationApply);
        when(scheduleApply.applyAfterMembershipCreated(any())).thenAnswer(a -> new AdmissionModuleResult(UUID.randomUUID(), List.of(), List.of()));
        when(certificationApply.applyAfterMembershipCreated(any())).thenThrow(new IllegalStateException("temporary failure"));
        assertThrows(IllegalStateException.class, () -> coordinator(List.of(certification, schedule)).acceptInvite("token", 7L));
        var order = inOrder(schedule, certification, members, scheduleApply, certificationApply);
        order.verify(schedule).prepare(any()); order.verify(certification).prepare(any());
        order.verify(members).save(any()); order.verify(scheduleApply).applyAfterMembershipCreated(any());
        order.verify(certificationApply).applyAfterMembershipCreated(any());
        assertEquals(1, tx.rollbacks.get()); assertEquals(0, tx.commits.get());
        assertEquals(InvitationStatus.PENDING, invite.getStatus());
        verifyNoInteractions(sender, owners);
    }
    @Test void invalidModulePlanCommitsOnlyTerminalOutcome() {
        var handler = mock(AdmissionLifecycleHandler.class);
        when(handler.prepare(any())).thenThrow(new AdmissionPlanInvalidException("SCHEDULE_CHANGED"));
        assertThrows(InvitationInvalidatedException.class, () -> coordinator(List.of(handler)).acceptInvite("token", 7L));
        verify(members, never()).save(any()); assertEquals(1, tx.commits.get());
    }

    @ParameterizedTest
    @CsvSource({
            "ADD_AND_REOPEN_COLLECTION, 6", "ADD_AND_REOPEN_COLLECTION, 7", "ADD_AND_REOPEN_COLLECTION, 8",
            "ADD_AND_REOPEN_FOR_REBUILD, 6", "ADD_AND_REOPEN_FOR_REBUILD, 7", "ADD_AND_REOPEN_FOR_REBUILD, 8"})
    void reopenAcceptsUnchangedHarmlesslyExtendedOrEqualCurrentDeadline(InvitationScheduleIntentAction action,
                                                                      int currentHoursAfterNow) {
        var schedules = mock(ru.staffly.schedule.repository.ScheduleRepository.class);
        var intents = mock(ru.staffly.invite.repository.InvitationScheduleIntentRepository.class);
        var lifecycle = mock(ru.staffly.schedule.service.SchedulePreferenceLifecycleService.class);
        var status = action == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                ? ru.staffly.schedule.model.ScheduleStatus.PREFERENCES_CLOSED
                : ru.staffly.schedule.model.ScheduleStatus.DRAFT_FROM_PREFERENCES;
        var schedule = ru.staffly.schedule.model.Schedule.builder().id(10L).restaurant(restaurant)
                .positions(Set.of(position)).status(status).preferenceDeadline(now.plusSeconds(currentHoursAfterNow * 3600L))
                .preferenceCollectionMode(ru.staffly.schedule.model.PreferenceCollectionMode.DAY_LEVEL).build();
        var requested = now.plusSeconds(8 * 3600); // 20:00, planned at original 18:00
        var intent = InvitationScheduleIntent.builder().expectedScheduleId(10L).selectedAction(action)
                .requestedDeadline(requested).expectedPreferenceDeadline(now.plusSeconds(6 * 3600)).build();
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(invite.getId())).thenReturn(List.of(intent));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(10L))).thenReturn(List.of(schedule));
        when(lifecycle.reopenForAdmissionWithLocksHeld(eq(schedule), any(), eq(requested), eq(7L), eq(now)))
                .thenReturn(new ru.staffly.schedule.service.SchedulePreferenceLifecycleService.ReopenMutationResult(true, false));
        var impact = new InvitationImpactService(null, null, null, null, null, null, time);
        var handler = new ru.staffly.schedule.lifecycle.ScheduleAdmissionLifecycleHandler(intents, schedules, impact, lifecycle);
        var result = coordinator(List.of(handler)).acceptInvite("token", 7L);
        assertEquals(42L, result.id());
        assertEquals(InvitationStatus.ACCEPTED, invite.getStatus());
        var order = inOrder(schedules, members, lifecycle);
        order.verify(schedules).findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(10L));
        order.verify(members).save(any());
        order.verify(lifecycle).reopenForAdmissionWithLocksHeld(schedule, invite.getAcceptedMember(), requested, 7L, now);
        assertEquals(1, tx.commits.get());
        assertEquals(0, tx.rollbacks.get());
    }

    @ParameterizedTest
    @EnumSource(value = InvitationScheduleIntentAction.class, names = {
            "ADD_AND_REOPEN_COLLECTION", "ADD_AND_REOPEN_FOR_REBUILD"})
    void changedReopenDeadlineInvalidatesWithoutMemberOrPartialScheduleMutation(InvitationScheduleIntentAction action) {
        assertReopenInvalidationBeforeMutation(action, now.plusSeconds(8 * 3600), "DEADLINE_CHANGED");
    }

    @ParameterizedTest
    @EnumSource(value = InvitationScheduleIntentAction.class, names = {
            "ADD_AND_REOPEN_COLLECTION", "ADD_AND_REOPEN_FOR_REBUILD"})
    void expiredReopenDeadlineInvalidatesWithoutMemberOrPartialScheduleMutation(InvitationScheduleIntentAction action) {
        assertReopenInvalidationBeforeMutation(action, now, "DEADLINE_EXPIRED");
    }

    private void assertReopenInvalidationBeforeMutation(InvitationScheduleIntentAction action,
                                                       Instant requestedDeadline, String reason) {
        var schedules = mock(ru.staffly.schedule.repository.ScheduleRepository.class);
        var intents = mock(ru.staffly.invite.repository.InvitationScheduleIntentRepository.class);
        var lifecycle = mock(ru.staffly.schedule.service.SchedulePreferenceLifecycleService.class);
        var status = action == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                ? ru.staffly.schedule.model.ScheduleStatus.PREFERENCES_CLOSED
                : ru.staffly.schedule.model.ScheduleStatus.DRAFT_FROM_PREFERENCES;
        var originalDeadline = now.plusSeconds(6 * 3600); // 18:00 at creation
        var currentDeadline = now.plusSeconds(9 * 3600); // 21:00 at ACCEPT
        var first = ru.staffly.schedule.model.Schedule.builder().id(10L).restaurant(restaurant)
                .positions(Set.of(position)).status(status).preferenceDeadline(originalDeadline)
                .preferenceCollectionMode(ru.staffly.schedule.model.PreferenceCollectionMode.DAY_LEVEL).build();
        var changed = ru.staffly.schedule.model.Schedule.builder().id(11L).restaurant(restaurant)
                .positions(Set.of(position)).status(status).preferenceDeadline(currentDeadline)
                .preferenceCollectionMode(ru.staffly.schedule.model.PreferenceCollectionMode.DAY_LEVEL).build();
        var firstIntent = InvitationScheduleIntent.builder().expectedScheduleId(10L).selectedAction(action)
                .requestedDeadline(now.plusSeconds(8 * 3600)).expectedPreferenceDeadline(originalDeadline).build();
        var changedIntent = InvitationScheduleIntent.builder().expectedScheduleId(11L).selectedAction(action)
                .requestedDeadline(requestedDeadline).expectedPreferenceDeadline(originalDeadline).build();
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(invite.getId()))
                .thenReturn(List.of(firstIntent, changedIntent));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(10L, 11L)))
                .thenReturn(List.of(first, changed));
        var impact = new InvitationImpactService(null, null, null, null, null, null, time);
        var handler = new ru.staffly.schedule.lifecycle.ScheduleAdmissionLifecycleHandler(intents, schedules, impact, lifecycle);
        var error = assertThrows(InvitationInvalidatedException.class,
                () -> coordinator(List.of(handler)).acceptInvite("token", 7L));
        assertEquals("INVITATION_INVALIDATED", error.getMeta().get("code"));
        assertEquals(reason, error.getMeta().get("reason"));
        assertEquals(InvitationStatus.INVALIDATED, invite.getStatus());
        assertNull(invite.getAcceptedMember());
        verify(members, never()).save(any());
        verifyNoInteractions(lifecycle, owners);
        assertEquals(originalDeadline, first.getPreferenceDeadline());
        assertEquals(currentDeadline, changed.getPreferenceDeadline());
        assertEquals(status, first.getStatus());
        assertEquals(status, changed.getStatus());
        assertEquals(0, first.getPreferenceCollectionCycle());
        assertEquals(0, changed.getPreferenceCollectionCycle());
        assertEquals(1, tx.commits.get());
        assertEquals(0, tx.rollbacks.get());
        verify(invites).saveAndFlush(invite);
        verify(sender).submitInvalidated(eq(invite), eq(user), eq(reason), any());
    }
    @Test void emailCompatibilityNormalizesContactAndLegacyRoleDoesNotGrantAuthority() {
        invite.setPhoneOrEmail(" Employee@Example.COM ");user.setEmail("employee@example.com");
        invite.setDesiredRole(RestaurantRole.ADMIN);
        var result = coordinator(List.of()).acceptInvite("token",7L);
        assertEquals(RestaurantRole.STAFF,result.role());
    }
    @Test void unrelatedUserCannotInvalidateOrAcceptTheInvitation() {
        user.setPhone("+78888888888");
        assertThrows(ru.staffly.common.exception.ConflictException.class, () -> coordinator(List.of()).acceptInvite("token",7L));
        assertEquals(InvitationStatus.PENDING,invite.getStatus());verify(members,never()).save(any());
    }
    @Test void expiredAndWrongContactCannotAdmit() {
        invite.setExpiresAt(now);
        assertThrows(InvitationExpiredException.class, () -> coordinator(List.of()).acceptInvite("token", 7L));
        assertEquals(InvitationStatus.EXPIRED, invite.getStatus());
        verify(members, never()).save(any());
    }
    @Test void sameUserDifferentInvitationsCannotCreateAnotherActivePeriod() {
        var second = invitation("other");
        var c = coordinator(List.of());
        when(invites.findForUpdateByToken("other")).thenReturn(Optional.of(second));
        when(members.existsByRestaurantIdAndUserIdAndEndedAtIsNull(1L, 7L)).thenReturn(false, true);
        c.acceptInvite("token", 7L);
        assertThrows(InvitationInvalidatedException.class, () -> c.acceptInvite("other", 7L));
        assertEquals(InvitationStatus.INVALIDATED, second.getStatus());
        verify(members, times(1)).save(any());
    }
    @Test void simultaneousSameTokenAcceptIsIdempotentBehindRestaurantMutex() throws Exception {
        var c = coordinator(List.of());
        doAnswer(a -> { tx.mutex.lock(); return null; }).when(mutex).lock(1L);
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            Callable<Long> accept = () -> { start.await(); return c.acceptInvite("token", 7L).id(); };
            var first = executor.submit(accept); var second = executor.submit(accept); start.countDown();
            assertEquals(42L, first.get(5, TimeUnit.SECONDS)); assertEquals(42L, second.get(5, TimeUnit.SECONDS));
            verify(members, times(1)).save(any());
        } finally { executor.shutdownNow(); }
    }
    @Test void creationWaitsForSameContactAcceptanceCommitThenRejectsActiveMember() throws Exception {
        var c = coordinator(List.of());
        var committedMember = new java.util.concurrent.atomic.AtomicBoolean();
        var acceptanceReady = new CountDownLatch(1);
        var creationWaitingForContact = new CountDownLatch(1);
        doAnswer(a -> { tx.mutex.lock(); return null; }).when(mutex).lock(1L);
        doAnswer(a -> {
            if (tx.contact.isLocked() && !tx.contact.isHeldByCurrentThread()) creationWaitingForContact.countDown();
            tx.contact.lock();
            return null;
        }).when(contactLock).lock(1L, user.getPhone());
        when(members.existsByRestaurantIdAndUserIdAndEndedAtIsNull(1L, 7L))
                .thenAnswer(a -> committedMember.get());
        doAnswer(a -> {
            RestaurantMember member = a.getArgument(0);member.setId(42L);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                public void afterCommit() { committedMember.set(true); }
            });
            acceptanceReady.countDown();
            assertTrue(creationWaitingForContact.await(5, TimeUnit.SECONDS), "creation must race before acceptance commits");
            return member;
        }).when(members).save(any());
        var restaurants = mock(ru.staffly.restaurant.repository.RestaurantRepository.class);
        when(restaurants.findById(1L)).thenReturn(Optional.of(restaurant));
        when(users.findByCanonicalPhone(user.getPhone())).thenReturn(Optional.of(user));
        var schedules = mock(ru.staffly.schedule.repository.ScheduleRepository.class);
        var intents = mock(ru.staffly.invite.repository.InvitationScheduleIntentRepository.class);
        var impact = new InvitationImpactService(restaurants, positions, schedules, users, members,
                mock(ru.staffly.security.SecurityService.class), time);
        var commands = new InvitationCommandService(invites, restaurants, users, schedules, intents, impact, time,
                new ru.staffly.invite.mapper.InvitationMapper(), mock(ru.staffly.security.SecurityService.class),
                sender, contactLock, positions);
        var proxy = new ProxyFactory(commands);proxy.setProxyTargetClass(true);
        proxy.addAdvice(new TransactionInterceptor(tx, new AnnotationTransactionAttributeSource()));
        var creation = (InvitationCommandService) proxy.getProxy();
        var executor = Executors.newFixedThreadPool(2);
        try {
            var accepted = executor.submit(() -> c.acceptInvite("token", 7L));
            assertTrue(acceptanceReady.await(5, TimeUnit.SECONDS));
            // Same contact in a different format must wait on acceptance's canonical contact lock.
            var rejected = executor.submit(() -> assertThrows(ru.staffly.common.exception.ConflictException.class,
                    () -> creation.invite(1L, 8L, new ru.staffly.invite.dto.InviteRequest(
                            "+7 (999) 999-99-99", 2L, List.of()))));
            assertEquals(42L, accepted.get(5, TimeUnit.SECONDS).id());
            assertEquals("User already a member", rejected.get(5, TimeUnit.SECONDS).getMessage());
            assertTrue(committedMember.get());assertEquals(InvitationStatus.ACCEPTED, invite.getStatus());
            assertEquals(1, tx.commits.get());assertEquals(1, tx.rollbacks.get());
            verify(contactLock, times(2)).lock(1L, user.getPhone());
            // Acceptance, pre-lock creation check, then authoritative post-lock creation check.
            verify(members, times(3)).existsByRestaurantIdAndUserIdAndEndedAtIsNull(1L, 7L);
            verify(invites, never()).findPendingForUpdateByContact(any(), any(), any());
            verify(invites, never()).save(argThat(i -> i.getStatus() == InvitationStatus.PENDING));
            verifyNoInteractions(intents, schedules);
        } finally { executor.shutdownNow(); }
    }

    /** Exercises Spring's real transaction interceptor; repositories are mocks, not a PostgreSQL integration test. */
    static class RecordingTx extends AbstractPlatformTransactionManager {
        final AtomicInteger commits = new AtomicInteger(), rollbacks = new AtomicInteger();
        final ReentrantLock mutex = new ReentrantLock();
        final ReentrantLock contact = new ReentrantLock();
        protected Object doGetTransaction() { return new Object(); }
        protected void doBegin(Object t, TransactionDefinition d) {}
        protected void doCommit(DefaultTransactionStatus s) { commits.incrementAndGet(); }
        protected void doRollback(DefaultTransactionStatus s) { rollbacks.incrementAndGet(); }
        protected void doCleanupAfterCompletion(Object t) {
            if (contact.isHeldByCurrentThread()) contact.unlock();
            if (mutex.isHeldByCurrentThread()) mutex.unlock();
        }
    }
}
