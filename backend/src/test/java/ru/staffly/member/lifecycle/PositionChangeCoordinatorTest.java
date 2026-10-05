package ru.staffly.member.lifecycle;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.dto.*;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.*;
import ru.staffly.member.service.PositionChangeNotificationService;
import ru.staffly.restaurant.model.*;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PositionChangeCoordinatorTest {
    private final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    private final PositionRepository positions = mock(PositionRepository.class);
    private final PositionChangeAuditRepository audits = mock(PositionChangeAuditRepository.class);
    private final SecurityService security = mock(SecurityService.class);
    private final PositionChangeNotificationService notifications = mock(PositionChangeNotificationService.class);
    private final RestaurantLifecycleMutex mutex = mock(RestaurantLifecycleMutex.class);
    private final Restaurant restaurant = Restaurant.builder().id(1L).build();
    private final Position old = Position.builder().id(1L).restaurant(restaurant).level(RestaurantRole.ADMIN).build();
    private final Position target = Position.builder().id(2L).restaurant(restaurant).level(RestaurantRole.MANAGER).build();
    private final RestaurantMember member = RestaurantMember.builder().id(17L).restaurant(restaurant).position(old)
            .user(User.builder().id(117L).build()).startedAt(Instant.parse("2026-10-05T12:00:00Z")).build();
    private PositionChangeCoordinator coordinator(List<PositionChangeLifecycleHandler> handlers) {
        return new PositionChangeCoordinator(handlers, members, positions, audits, mock(MemberMapper.class), security,
                mock(RestaurantTimeService.class), notifications, mock(UserRepository.class), mutex);
    }
    private ApplyPositionChangeRequest request() {
        return new ApplyPositionChangeRequest(2L, 1L, member.getStartedAt(), List.of(), PositionChangeImpactPlan.PositionSnapshot.of(old),
                PositionChangeImpactPlan.PositionSnapshot.of(target), List.of(), List.of(), List.of(), List.of(), List.of());
    }
    private void stub() {
        when(members.findWithUserAndPositionByIdAndRestaurantId(17L, 1L)).thenReturn(Optional.of(member));
        when(members.findForUpdateByIdAndRestaurantId(17L, 1L)).thenReturn(Optional.of(member));
        when(positions.findById(2L)).thenReturn(Optional.of(target));
        when(positions.findForShareByIdAndRestaurantId(2L, 1L)).thenReturn(Optional.of(target));
        when(security.isAdmin(anyLong(), eq(1L))).thenReturn(true);
    }

    @Test void selfChangeIsForbiddenInPreviewAndApplyEvenForAdmin() {
        stub();
        var c = coordinator(List.of());
        assertThrows(ForbiddenException.class, () -> c.preview(1L, 17L, 2L, 117L));
        assertThrows(ForbiddenException.class, () -> c.apply(1L, 17L, request(), 117L));
        verifyNoInteractions(audits, notifications);
        verify(members, never()).save(any());
    }
    @Test void lastAdminDemotionFailsUnderRestaurantMutex() {
        stub();
        when(members.countActiveByRestaurantIdAndPositionLevel(1L, RestaurantRole.ADMIN)).thenReturn(1L);
        assertThrows(ConflictException.class, () -> coordinator(List.of()).apply(1L, 17L, request(), 999L));
        var order = inOrder(mutex, members);
        order.verify(mutex).lock(1L);
        order.verify(members).findForUpdateByIdAndRestaurantId(17L, 1L);
        order.verify(members).countActiveByRestaurantIdAndPositionLevel(1L, RestaurantRole.ADMIN);
        assertSame(old, member.getPosition());
        verifyNoInteractions(audits, notifications);
    }
    @Test void changedTargetDefinitionFailsWithPositionChangeConflict() {
        stub();
        var request = request();
        target.setName("Changed after preview");
        var ex = assertThrows(ConflictException.class, () -> coordinator(List.of()).apply(1L, 17L, request, 999L));
        assertTrue(ex.getMessage().contains("POSITION_CHANGE_PLAN_STALE"));
        verifyNoInteractions(audits, notifications);
    }
    @Test void managerCannotPromoteStaffToManagement() {
        stub();
        old.setLevel(RestaurantRole.STAFF);
        when(security.isAdmin(999L, 1L)).thenReturn(false);
        assertThrows(ForbiddenException.class, () -> coordinator(List.of()).preview(1L, 17L, 2L, 999L));
    }
    @Test void duplicateModuleHandlersAreRejectedAtStartup() {
        var first = mock(PositionChangeLifecycleHandler.class);
        var second = mock(PositionChangeLifecycleHandler.class);
        when(first.module()).thenReturn(LifecycleModule.TASK);
        when(second.module()).thenReturn(LifecycleModule.TASK);
        assertThrows(IllegalStateException.class, () -> coordinator(List.of(first, second)).validateUniqueHandlers());
    }

    @Test void previewReadsModuleSnapshotsWithoutAcquiringLifecycleMutex() throws Exception {
        stub();
        when(members.countActiveByRestaurantIdAndPositionLevel(1L, RestaurantRole.ADMIN)).thenReturn(2L);
        var impacts = List.<PositionChangeModuleImpact>of(
                new ru.staffly.schedule.lifecycle.SchedulePositionChangeImpact(List.of(), List.of(), List.of(), List.of()),
                new ru.staffly.training.lifecycle.CertificationPositionChangeImpact(true, List.of(), List.of(), List.of()),
                new ru.staffly.task.lifecycle.TaskPositionChangeLifecycleHandler.Impact(List.of()),
                new ru.staffly.checklist.lifecycle.ChecklistPositionChangeLifecycleHandler.Impact(0));
        var handlers = impacts.stream().map(impact -> {
            var handler = mock(PositionChangeLifecycleHandler.class);
            when(handler.preview(any())).thenReturn(impact);
            return handler;
        }).toList();
        var plan = coordinator(handlers).preview(1L, 17L, 2L, 999L);
        assertEquals(2L, plan.employee().newPosition().id());
        verifyNoInteractions(mutex);
        verify(security).assertAtLeastManager(999L, 1L);
        handlers.forEach(handler -> verify(handler).preview(any()));
        var transaction = PositionChangeCoordinator.class
                .getMethod("preview", Long.class, Long.class, Long.class, Long.class)
                .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
        assertTrue(transaction.readOnly());
    }
}
