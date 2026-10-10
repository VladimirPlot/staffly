package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.*;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.dto.*;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.*;
import ru.staffly.member.service.*;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.lifecycle.*;
import ru.staffly.security.*;
import ru.staffly.training.lifecycle.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamRepository;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real lifecycle coordinators, transition policies, Certification adapter and owner policy. */
class CrossScopeCertificationLifecycleTest {
    private final Instant now = Instant.parse("2026-10-06T12:00:00Z");
    private final Restaurant restaurant = Restaurant.builder().id(1L).build();
    private final Position manager = position(1L, RestaurantRole.MANAGER, false);
    private final Position examiner = position(2L, RestaurantRole.STAFF, true);
    private final Position staff = position(3L, RestaurantRole.STAFF, false);
    private final Position adminExaminer = position(4L, RestaurantRole.ADMIN, true);
    private final RestaurantMember actor = member(11L, 101L, manager);
    private final RestaurantMember target = member(12L, 102L, examiner);
    private final RestaurantMember replacement = member(13L, 103L, adminExaminer);
    private final TrainingExam exam = TrainingExam.builder().id(20L).restaurant(restaurant)
            .mode(TrainingExamMode.CERTIFICATION).title("Cross scope").owner(target.getUser())
            .editorRevision(7L).visibilityPositions(new HashSet<>(Set.of(manager, adminExaminer)))
            .folder(TrainingFolder.builder().id(30L).restaurant(restaurant).build()).build();
    private final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    private final PositionRepository positions = mock(PositionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final TrainingExamRepository exams = mock(TrainingExamRepository.class);
    private final RestaurantLifecycleMutex mutex = mock(RestaurantLifecycleMutex.class);
    private final EntityManager em = mock(EntityManager.class);
    private final CertificationFolderManagementService folders = mock(CertificationFolderManagementService.class);
    private final CertificationAudienceSyncService audience = mock(CertificationAudienceSyncService.class);
    private final RestaurantTimeService time = mock(RestaurantTimeService.class);
    private final TrainingPolicyService policy = spy(new TrainingPolicyService(members, positions, new SecurityService(members, mock(RestaurantRepository.class))));
    private final TrainingExamOwnershipService ownership = new TrainingExamOwnershipService(exams, members, policy,
            folders, mutex, em, new GlobalCreatorPolicy("+79999999999"), users);
    private final CertificationEmployeeLifecycleHandler certification = new CertificationEmployeeLifecycleHandler(audience, ownership, members);
    private final SecurityService security = new SecurityService(members, mock(RestaurantRepository.class));

    CrossScopeCertificationLifecycleTest() {
        SecurityContextHolder.clearContext();
        when(time.nowInstant()).thenReturn(now);
        when(positions.findByRestaurantId(1L)).thenReturn(List.of(manager, examiner, staff, adminExaminer));
        for (var member : List.of(actor, target, replacement)) {
            when(members.findActiveByUserIdAndRestaurantId(member.getUser().getId(), 1L)).thenReturn(Optional.of(member));
            when(members.findActiveByUserIdAndRestaurantIdWithPosition(member.getUser().getId(), 1L)).thenReturn(Optional.of(member));
            when(users.findById(member.getUser().getId())).thenReturn(Optional.of(member.getUser()));
        }
        when(members.findActiveWithUserAndPositionByRestaurantId(1L)).thenReturn(List.of(actor, target, replacement));
        when(members.findWithUserAndPositionByIdAndRestaurantId(12L, 1L)).thenReturn(Optional.of(target));
        when(members.findForUpdateByIdAndRestaurantId(12L, 1L)).thenReturn(Optional.of(target));
        when(positions.findById(3L)).thenReturn(Optional.of(staff));
        when(positions.findForShareByIdAndRestaurantId(3L, 1L)).thenReturn(Optional.of(staff));
        when(exams.findOwnedCertificationForLifecycle(1L, 102L)).thenReturn(List.of(exam));
        when(exams.findCertificationForLifecycleTransfer(1L, List.of(20L))).thenReturn(List.of(exam));
        when(exams.findByIdAndRestaurantIdForUpdate(20L, 1L)).thenReturn(Optional.of(exam));
        when(exams.findByIdAndRestaurantIdWithVisibility(20L, 1L)).thenReturn(Optional.of(exam));
    }

    @AfterEach void cleanup() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization();
        SecurityContextHolder.clearContext();
    }
    private Position position(Long id, RestaurantRole role, boolean examiner) {
        return Position.builder().id(id).name("Position " + id).restaurant(restaurant).level(role)
                .specializations(examiner ? Set.of(PositionSpecialization.EXAMINER) : Set.of()).build();
    }
    private RestaurantMember member(Long id, Long userId, Position position) {
        return RestaurantMember.builder().id(id).restaurant(restaurant).position(position).startedAt(now)
                .user(User.builder().id(userId).build()).build();
    }
    private ApplyEmployeeRemovalRequest.OwnershipTransfer transfer(Long userId) {
        return new ApplyEmployeeRemovalRequest.OwnershipTransfer(20L, 7L, 102L, userId);
    }
    private void assertActorOutsideManualScope() {
        assertTrue(policy.canManageTraining(101L, 1L));
        assertFalse(policy.canManageCertificationTargets(101L, 1L, Set.of(1L, 4L)));
        clearInvocations(policy);
    }
    private void assertNoManualAuthorizationInLifecycle() {
        verify(policy, never()).canManageTraining(101L, 1L);
        verify(policy, never()).assertCanManageCertificationTargets(eq(101L), anyLong(), anySet());
        verifyNoInteractions(folders);
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void managerTerminatesStaffExaminerWithCrossScopeMandatoryHandoff(boolean active) {
        exam.setActive(active);
        assertActorOutsideManualScope();
        var coordinator = terminationCoordinator();
        var plan = coordinator.preview(1L, 12L, 101L);
        assertEquals(List.of(20L), plan.certificationOwnership().requiredTransfers().stream().map(r -> r.resourceId()).toList());
        assertEquals(List.of(103L), plan.certificationOwnership().requiredTransfers().get(0).candidates().stream().map(c -> c.userId()).toList());
        TransactionSynchronizationManager.initSynchronization();
        var result = coordinator.apply(1L, 12L, new ApplyEmployeeRemovalRequest(now, 2L, List.of(), List.of(),
                List.of(transfer(103L)), new ApplyEmployeeRemovalRequest.TaskDecisions(List.of(), List.of())), 101L);
        assertEquals(1, result.certificationOwnersTransferred());
        assertEquals(103L, exam.getOwner().getId());
        assertEquals(active, exam.isActive());
        assertNotNull(target.getEndedAt());
        verify(members).save(target);
        assertNoManualAuthorizationInLifecycle();
    }

    @ParameterizedTest @ValueSource(booleans = {true, false})
    void managerMovesStaffExaminerToStaffWithSameMembershipAndCrossScopeHandoff(boolean active) {
        exam.setActive(active);
        assertActorOutsideManualScope();
        var coordinator = positionCoordinator();
        var plan = coordinator.preview(1L, 12L, 3L, 101L);
        assertEquals(List.of(20L), plan.certificationOwnership().stream().map(r -> r.resourceId()).toList());
        var started = target.getStartedAt();
        coordinator.apply(1L, 12L, new ApplyPositionChangeRequest(3L, 2L, now, List.of(),
                plan.currentPositionSnapshot(), plan.targetPositionSnapshot(), List.of(), plan.certificationOwnershipState(),
                List.of(), List.of(transfer(103L)), List.of()), 101L);
        assertEquals(103L, exam.getOwner().getId());
        assertEquals(active, exam.isActive());
        assertSame(staff, target.getPosition());
        assertEquals(12L, target.getId());
        assertEquals(started, target.getStartedAt());
        assertNull(target.getEndedAt());
        verify(members).save(target);
        assertNoManualAuthorizationInLifecycle();
    }

    @Test void manualOwnerChangeStillRejectsTheSameUnderScopedManager() {
        assertActorOutsideManualScope();
        assertThrows(ForbiddenException.class, () -> manualService().changeCertificationExamOwner(1L, 101L, 20L, 103L));
        assertEquals(102L, exam.getOwner().getId());
        verify(policy).assertCanManageCertificationTargets(101L, 1L, Set.of(1L, 4L));
    }
    @Test void manualOwnerChangeStillChecksContainerAuthority() {
        exam.setVisibilityPositions(new HashSet<>(Set.of(staff)));
        doThrow(new ForbiddenException("Container forbidden")).when(folders).assertSubtreeManageable(1L, 101L, 30L);
        assertThrows(ForbiddenException.class, () -> manualService().changeCertificationExamOwner(1L, 101L, 20L, 103L));
        assertEquals(102L, exam.getOwner().getId());
        verify(folders).assertSubtreeManageable(1L, 101L, 30L);
    }
    @Test void missingMandatoryTransferIsStillRejected() {
        assertThrows(ConflictException.class, () -> certification.applyBeforeTermination(terminationContext(),
                new CertificationTerminationDecision(List.of())));
        assertEquals(102L, exam.getOwner().getId());
    }
    @Test void globalCreatorCanTerminateWithoutSyntheticActorMembership() {
        var creator = User.builder().id(999L).phone("+79999999999").build();
        when(users.findById(999L)).thenReturn(Optional.of(creator));
        SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                999L, null, List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_CREATOR"))));
        var coordinator = terminationCoordinator();
        assertEquals(1, coordinator.preview(1L, 12L, 999L).certificationOwnership().requiredTransfers().size());
        TransactionSynchronizationManager.initSynchronization();
        coordinator.apply(1L, 12L, new ApplyEmployeeRemovalRequest(now, 2L, List.of(), List.of(),
                List.of(transfer(103L)), new ApplyEmployeeRemovalRequest.TaskDecisions(List.of(), List.of())), 999L);
        assertNotNull(target.getEndedAt());
        assertEquals(103L, exam.getOwner().getId());
        verify(members, never()).findActiveByUserIdAndRestaurantIdWithPosition(999L, 1L);
        verify(members, times(1)).save(target);
        verifyNoInteractions(folders);
    }
    @ParameterizedTest @ValueSource(strings = {"missing", "incapable", "scope", "departing"})
    void lifecycleCannotAssignAnInvalidCandidate(String reason) {
        if (reason.equals("missing")) when(members.findActiveByUserIdAndRestaurantIdWithPosition(103L, 1L)).thenReturn(Optional.empty());
        if (reason.equals("incapable")) replacement.setPosition(staff);
        if (reason.equals("scope")) replacement.setPosition(manager);
        Class<? extends RuntimeException> expected = reason.equals("incapable") || reason.equals("scope")
                ? ForbiddenException.class : BadRequestException.class;
        assertThrows(expected,
                () -> certification.applyBeforeTermination(terminationContext(),
                new CertificationTerminationDecision(List.of(transfer(reason.equals("departing") ? 102L : 103L)))));
        assertEquals(102L, exam.getOwner().getId());
        verify(exams, never()).flush();
    }
    @ParameterizedTest @ValueSource(strings = {"owner", "revision", "absent"})
    void lifecyclePrimitiveRetainsAuthoritativeSnapshotChecks(String reason) {
        if (reason.equals("owner")) exam.setOwner(actor.getUser());
        if (reason.equals("revision")) exam.setEditorRevision(8L);
        if (reason.equals("absent")) when(exams.findCertificationForLifecycleTransfer(1L, List.of(20L))).thenReturn(List.of());
        Class<? extends RuntimeException> expected = reason.equals("absent") ? NotFoundException.class : ConflictException.class;
        assertThrows(expected,
                () -> ownership.batchReassignForLifecycleWithLocksHeld(1L, 102L, List.of(Map.entry(20L, 103L)), Map.of(20L, 7L)));
        verify(exams, never()).flush();
    }
    private TerminationApplyContext terminationContext() {
        return new TerminationApplyContext(1L, 101L, target, TerminationMode.FORCED, now, UUID.randomUUID());
    }
    private ExamServiceImpl manualService() {
        var service = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "trainingExamOwnershipService", ownership);
        ReflectionTestUtils.setField(service, "exams", exams);
        return service;
    }
    private TerminateMembershipCoordinator terminationCoordinator() {
        var impacts = List.<TerminationModuleImpact>of(
                new ScheduleTerminationImpact(List.of(), List.of()),
                new ru.staffly.task.lifecycle.TaskTerminationImpact(List.of(), List.of()),
                new ru.staffly.checklist.lifecycle.ChecklistTerminationImpact(0),
                new ru.staffly.reminder.lifecycle.ReminderTerminationImpact(0));
        var results = List.<TerminationModuleResult>of(
                new ScheduleTerminationResult(List.of(), 0, 0, 0, 0, 0, List.of(), List.of()),
                new ru.staffly.task.lifecycle.TaskTerminationResult(0, 0, 0, List.of(), List.of(), List.of()),
                new ru.staffly.checklist.lifecycle.ChecklistTerminationResult(0),
                new ru.staffly.reminder.lifecycle.ReminderTerminationResult(0));
        var handlers = new ArrayList<TerminationLifecycleHandler>();
        for (int i = 0; i < impacts.size(); i++) {
            var handler = mock(TerminationLifecycleHandler.class);
            when(handler.module()).thenReturn(impacts.get(i).module());
            when(handler.preview(any())).thenReturn(impacts.get(i));
            when(handler.applyAfterTermination(any(), any(), any())).thenReturn(results.get(i));
            handlers.add(handler);
        }
        handlers.add(certification);
        return new TerminateMembershipCoordinator(handlers, members, users, new MemberRemovalPolicyService(members, security),
                mutex, mock(EmployeeRemovalAuditRepository.class), time, mock(ru.staffly.push.service.PushEnqueueService.class),
                mock(TerminationNotificationService.class));
    }
    private PositionChangeCoordinator positionCoordinator() {
        var impacts = List.<PositionChangeModuleImpact>of(
                new SchedulePositionChangeImpact(List.of(), List.of(), List.of(), List.of()),
                new ru.staffly.task.lifecycle.TaskPositionChangeLifecycleHandler.Impact(List.of()),
                new ru.staffly.checklist.lifecycle.ChecklistPositionChangeLifecycleHandler.Impact(0));
        var results = List.<PositionChangeModuleResult>of(
                new SchedulePositionChangeResult(List.of(), List.of(), 0, List.of(), List.of(), List.of(), List.of()),
                new ru.staffly.task.lifecycle.TaskPositionChangeLifecycleHandler.Result(List.of()),
                new ru.staffly.checklist.lifecycle.ChecklistPositionChangeLifecycleHandler.Result(0));
        var handlers = new ArrayList<PositionChangeLifecycleHandler>();
        for (int i = 0; i < impacts.size(); i++) {
            var handler = mock(PositionChangeLifecycleHandler.class);
            when(handler.module()).thenReturn(impacts.get(i).module());
            when(handler.preview(any())).thenReturn(impacts.get(i));
            when(handler.applyAfterPositionChange(any(), any(), any())).thenReturn(results.get(i));
            handlers.add(handler);
        }
        handlers.add(certification);
        return new PositionChangeCoordinator(handlers, members, positions, mock(PositionChangeAuditRepository.class),
                mock(MemberMapper.class), security, time, mock(PositionChangeNotificationService.class), users, mutex);
    }
}
