package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.OwnershipTransfer;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.GlobalCreatorPolicy;
import ru.staffly.security.SecurityService;
import ru.staffly.training.dto.UpdateTrainingExamRequest;
import ru.staffly.training.lifecycle.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class HiddenCertificationOwnershipTest {
    private final Restaurant restaurant = Restaurant.builder().id(1L).build();
    private final Instant now = Instant.parse("2026-10-06T12:00:00Z");
    private final Position staff = position(1, RestaurantRole.STAFF);
    private final Position manager = position(2, RestaurantRole.MANAGER);
    private final Position admin = position(3, RestaurantRole.ADMIN);
    private final User oldUser = User.builder().id(101L).phone("+70000000001").build();
    private final User replacementUser = User.builder().id(102L).phone("+70000000002").build();
    private final RestaurantMember old = member(17, oldUser, manager);
    private final RestaurantMember replacement = member(18, replacementUser, admin);
    private final TrainingExam hidden = TrainingExam.builder().id(10L).restaurant(restaurant).title("Hidden")
            .owner(oldUser).createdBy(oldUser).active(false).editorRevision(4L)
            .questionCount(1).passPercent(80).visibilityPositions(new HashSet<>(Set.of(staff))).build();
    private final TrainingExamRepository exams = mock(TrainingExamRepository.class);
    private final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    private final PositionRepository positions = mock(PositionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final EntityManager em = mock(EntityManager.class);
    private final RestaurantLifecycleMutex mutex = mock(RestaurantLifecycleMutex.class);
    private final CertificationAudienceSyncService audience = mock(CertificationAudienceSyncService.class);
    private final CertificationAssignmentService assignments = mock(CertificationAssignmentService.class);
    private final TrainingExamOwnershipService ownership = new TrainingExamOwnershipService(exams, members,
            new TrainingPolicyService(members, positions, new SecurityService(members, mock(RestaurantRepository.class))),
            mock(CertificationFolderManagementService.class), mutex,
            em, new GlobalCreatorPolicy("+79999999999"), users);
    private final CertificationEmployeeLifecycleHandler handler = new CertificationEmployeeLifecycleHandler(audience, ownership, members);

    HiddenCertificationOwnershipTest() {
        when(positions.findByRestaurantId(1L)).thenReturn(List.of(staff, manager, admin));
        when(users.findById(101L)).thenReturn(Optional.of(oldUser));
        when(users.findById(102L)).thenReturn(Optional.of(replacementUser));
        when(members.findActiveByUserIdAndRestaurantIdWithPosition(101L, 1L)).thenReturn(Optional.of(old));
        when(members.findActiveByUserIdAndRestaurantIdWithPosition(102L, 1L)).thenReturn(Optional.of(replacement));
        when(members.findActiveWithUserAndPositionByRestaurantId(1L)).thenReturn(List.of(old, replacement));
        when(exams.findOwnedCertificationForLifecycle(eq(1L), anyLong())).thenAnswer(call ->
                Objects.equals(hidden.getOwner().getId(), call.getArgument(1)) ? List.of(hidden) : List.of());
        when(exams.findCertificationForLifecycleTransfer(1L, List.of(10L))).thenReturn(List.of(hidden));
        when(exams.findByIdAndRestaurantIdForUpdate(10L, 1L)).thenReturn(Optional.of(hidden));
        when(exams.findByIdAndRestaurantIdWithVisibility(10L, 1L)).thenReturn(Optional.of(hidden));
    }

    private Position position(long id, RestaurantRole level) {
        return Position.builder().id(id).name("Position " + id).restaurant(restaurant).level(level).build();
    }
    private RestaurantMember member(long id, User user, Position position) {
        return RestaurantMember.builder().id(id).user(user).restaurant(restaurant).position(position).startedAt(now).build();
    }
    private OwnershipTransfer transfer() { return new OwnershipTransfer(10L, 4L, 101L, 102L); }
    private TerminationApplyContext termination() {
        return new TerminationApplyContext(1L, 102L, old, TerminationMode.FORCED, now, UUID.randomUUID());
    }

    @Test void terminationImpactIncludesHiddenOwnershipAndRequiresTransfer() {
        var impact = handler.preview(new TerminationPreviewContext(1L, 102L, old, TerminationMode.FORCED, now));
        assertEquals(List.of(10L), impact.ownership().stream().map(r -> r.resourceId()).toList());
        assertThrows(ConflictException.class, () -> handler.applyBeforeTermination(termination(),
                new CertificationTerminationDecision(List.of())));
        assertSame(oldUser, hidden.getOwner());
        verifyNoInteractions(audience);
    }

    @Test void terminationTransfersHiddenOwnerWithoutActivatingAudienceAndRehireCannotReclaimIt() {
        var result = handler.applyBeforeTermination(termination(), new CertificationTerminationDecision(List.of(transfer())));
        assertEquals(1, result.ownersTransferred());
        assertEquals(102L, hidden.getOwner().getId());
        assertFalse(hidden.isActive());
        assertFalse(result.ownershipTransfers().get(0).active());
        assertEquals(1, hidden.getVersion());
        verifyNoInteractions(audience, assignments);
        old.end(replacementUser, now);
        var rehire = member(42, oldUser, manager);
        when(members.findActiveByUserIdAndRestaurantIdWithPosition(101L, 1L)).thenReturn(Optional.of(rehire));
        assertTrue(ownership.findOwnedCertificationForLifecycle(1L, 101L).isEmpty());
        assertEquals(102L, hidden.getOwner().getId());
    }

    @Test void positionCapabilityLossIncludesAndTransfersHiddenResource() {
        var impact = handler.preview(new PositionChangePreviewContext(1L, 102L, old, manager, staff, now));
        assertEquals(List.of(10L), impact.ownership().stream().map(r -> r.resourceId()).toList());
        assertTrue(impact.audienceChanges().isEmpty());
        var context = new PositionChangeApplyContext(1L, 102L, old, manager, staff, now, UUID.randomUUID());
        assertThrows(ConflictException.class, () -> handler.applyBeforePositionChange(context,
                new CertificationPositionChangeDecision(List.of(), impact.ownershipState())));
        var preparation = handler.applyBeforePositionChange(context,
                new CertificationPositionChangeDecision(List.of(transfer()), impact.ownershipState()));
        assertEquals(1, preparation.transfers().size());
        assertEquals(102L, hidden.getOwner().getId());
        assertFalse(hidden.isActive());
        verifyNoInteractions(audience, assignments);
    }

    @Test void lifecycleLocksHiddenAndActiveUnionInAscendingExamOrder() {
        var active = TrainingExam.builder().id(20L).restaurant(restaurant).owner(replacementUser).build();
        when(exams.findActiveCertificationByRestaurantIdWithVisibility(1L)).thenReturn(List.of(active));
        when(exams.findByIdAndRestaurantIdForUpdate(20L, 1L)).thenReturn(Optional.of(active));
        ownership.lockCertificationLifecycleResources(1L, 101L);
        var order = inOrder(exams, em);
        order.verify(exams).findByIdAndRestaurantIdForUpdate(10L, 1L);
        order.verify(em).refresh(hidden);
        order.verify(exams).findByIdAndRestaurantIdForUpdate(20L, 1L);
        order.verify(em).refresh(active);
    }

    @Test void hiddenTerminationHandoffDoesNotNotifyEmployees() {
        var inbox = mock(ru.staffly.inbox.service.InboxMessageService.class);
        var schedule = new ru.staffly.schedule.lifecycle.ScheduleTerminationResult(List.of(), 0, 0, 0, 0, 0, List.of(), List.of());
        var tasks = new ru.staffly.task.lifecycle.TaskTerminationResult(0, 0, 0, List.of(), List.of(), List.of());
        var result = handler.applyBeforeTermination(termination(), new CertificationTerminationDecision(List.of(transfer())));
        new ru.staffly.member.service.TerminationNotificationService(inbox, members)
                .notify(restaurant, replacementUser, UUID.randomUUID(), tasks, schedule, result);
        verifyNoInteractions(inbox);
    }

    @Test void hiddenPositionHandoffDoesNotAddCertificationNotification() {
        var afterCommit = mock(ru.staffly.inbox.service.BusinessNotificationAfterCommitService.class);
        new ru.staffly.member.service.PositionChangeNotificationService(members, afterCommit).submit(old, replacementUser,
                UUID.randomUUID(), "Manager", "Staff", List.of(), List.of(), List.of(),
                List.of(new ru.staffly.training.dto.AppliedCertificationOwnershipTransfer(10L, "Hidden", 102L, false)), List.of());
        var captor = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(afterCommit).submit(captor.capture());
        List<ru.staffly.inbox.service.BusinessNotificationCommand> commands = captor.getValue();
        assertEquals(1, commands.size());
        assertEquals(ru.staffly.inbox.model.BusinessNotificationKind.POSITION_CHANGE, commands.get(0).kind());
    }

    @ParameterizedTest @ValueSource(strings = {"ended", "incapable", "visibility", "missing"})
    void restoreRejectsInvalidLegacyOwnerBeforeAnyAudienceRestoration(String reason) {
        if (reason.equals("ended")) when(members.findActiveByUserIdAndRestaurantIdWithPosition(101L, 1L)).thenReturn(Optional.empty());
        if (reason.equals("incapable")) old.setPosition(staff);
        if (reason.equals("visibility")) hidden.setVisibilityPositions(new HashSet<>(Set.of(admin)));
        if (reason.equals("missing")) hidden.setOwner(null);
        var service = examService();
        var conflict = assertThrows(ConflictException.class, () -> service.restoreExam(1L, 102L, 10L));
        assertEquals("CERTIFICATION_OWNER_INVALID", conflict.getMeta().get("code"));
        assertFalse(hidden.isActive());
        verifyNoInteractions(audience, assignments);
        verify(exams, never()).flush();
    }

    @Test void updateActivationRejectsInvalidOwnerBeforeContentOrAudienceMutation() {
        when(members.findActiveByUserIdAndRestaurantIdWithPosition(101L, 1L)).thenReturn(Optional.empty());
        var service = examService();
        var request = new UpdateTrainingExamRequest(4L, "Changed", null, 1, 80, null,
                TrainingExamMode.CERTIFICATION, null, null, null, true, List.of(1L), List.of(), List.of(), false);
        var conflict = assertThrows(ConflictException.class, () -> service.updateExam(1L, 102L, 10L, request));
        assertEquals("CERTIFICATION_OWNER_INVALID", conflict.getMeta().get("code"));
        assertEquals("Hidden", hidden.getTitle());
        assertFalse(hidden.isActive());
        verifyNoInteractions(audience, assignments);
        verify(em, never()).lock(hidden, jakarta.persistence.LockModeType.OPTIMISTIC_FORCE_INCREMENT);
    }

    @Test void updateActivationChecksResultingVisibilityRatherThanOldScope() {
        var request = new UpdateTrainingExamRequest(4L, "Changed", null, 1, 80, null,
                TrainingExamMode.CERTIFICATION, null, null, null, true, List.of(3L), List.of(), List.of(), false);
        var conflict = assertThrows(ConflictException.class, () -> examService().updateExam(1L, 102L, 10L, request));
        assertEquals("CERTIFICATION_OWNER_INVALID", conflict.getMeta().get("code"));
        assertFalse(hidden.isActive());
        assertEquals(Set.of(staff), hidden.getVisibilityPositions());
        verifyNoInteractions(audience, assignments);
    }

    @Test void currentEligibleOwnerRestoresSuccessfullyAfterMutexAndOwnerCheck() {
        var dto = examService().restoreExam(1L, 102L, 10L);
        assertTrue(dto.active());
        assertTrue(hidden.isActive());
        var order = inOrder(mutex, em, users, members, assignments, audience);
        order.verify(mutex).lock(1L);
        order.verify(em).lock(hidden, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        order.verify(em).refresh(hidden, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        order.verify(users).findById(101L);
        order.verify(members).findActiveByUserIdAndRestaurantIdWithPosition(101L, 1L);
        order.verify(assignments).restoreHiddenAudienceAssignments(hidden);
        order.verify(audience).syncExamAudience(hidden);
    }

    @Test void explicitCreatorInitialUserOwnerRestoresWithoutMembershipAndIsNotAReassignmentCandidate() {
        var creator = User.builder().id(7L).phone("+79999999999").build();
        when(users.findById(7L)).thenReturn(Optional.of(creator));
        ownership.assignInitialOwner(hidden, 7L);
        var service = examService();
        clearInvocations(members);
        assertTrue(service.restoreExam(1L, 102L, 10L).active());
        assertEquals(7L, hidden.getCreatedBy().getId());
        assertEquals(7L, hidden.getOwner().getId());
        verify(members, never()).findActiveByUserIdAndRestaurantIdWithPosition(7L, 1L);
        verify(members, never()).save(any());
        assertTrue(ownership.lifecycleCandidates(hidden, 17L, staff).stream()
                .noneMatch(m -> m.getUser().getId().equals(7L)));
        assertThrows(ru.staffly.common.exception.BadRequestException.class, () -> ownership.validateOwnerCandidate(hidden, 7L));
    }

    private ExamServiceImpl examService() {
        var service = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "exams", exams);
        ReflectionTestUtils.setField(service, "lifecycleMutex", mutex);
        ReflectionTestUtils.setField(service, "entityManager", em);
        ReflectionTestUtils.setField(service, "positions", positions);
        ReflectionTestUtils.setField(service, "trainingPolicyService", mock(TrainingPolicyService.class));
        ReflectionTestUtils.setField(service, "trainingExamOwnershipService", ownership);
        ReflectionTestUtils.setField(service, "activeContainerValidator", mock(TrainingActiveContainerValidator.class));
        ReflectionTestUtils.setField(service, "certificationAssignmentService", assignments);
        ReflectionTestUtils.setField(service, "certificationAudienceSyncService", audience);
        ReflectionTestUtils.setField(service, "sourceFolders", mock(TrainingExamSourceFolderRepository.class));
        ReflectionTestUtils.setField(service, "sourceQuestions", mock(TrainingExamSourceQuestionRepository.class));
        var pool = mock(ExamQuestionPoolResolver.class);
        when(pool.resolveAvailableQuestionCount(anyLong(), anyLong(), any(), anyList(), anyList())).thenReturn(1);
        ReflectionTestUtils.setField(service, "questionPoolResolver", pool);
        return service;
    }
}
