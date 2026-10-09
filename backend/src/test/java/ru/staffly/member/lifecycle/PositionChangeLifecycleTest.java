package ru.staffly.member.lifecycle;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.*;
import ru.staffly.user.model.User;
import ru.staffly.task.model.*;
import ru.staffly.task.repository.TaskRepository;
import ru.staffly.task.lifecycle.TaskPositionChangeLifecycleHandler;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.TaskTransfer;
import ru.staffly.checklist.model.*;
import ru.staffly.checklist.repository.ChecklistItemRepository;
import ru.staffly.checklist.lifecycle.ChecklistPositionChangeLifecycleHandler;
import ru.staffly.training.service.TrainingPolicyService;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.service.ScheduleRowMaterializer;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PositionChangeLifecycleTest {
    private final Restaurant restaurant = Restaurant.builder().id(1L).build();
    private final Instant now = Instant.parse("2026-10-05T12:00:00Z");
    private Position position(long id, RestaurantRole role) {
        return Position.builder().id(id).restaurant(restaurant).name("Position " + id).level(role).build();
    }
    private RestaurantMember member(long id, Position position) {
        return RestaurantMember.builder().id(id).restaurant(restaurant).position(position)
                .user(User.builder().id(id + 100).fullName("Member " + id).build()).startedAt(now).build();
    }
    private PositionChangeApplyContext context(RestaurantMember m, Position target) {
        return new PositionChangeApplyContext(1L, 999L, m, m.getPosition(), target, now, UUID.randomUUID());
    }

    @Test void demotionTransfersSetterAndPreservesIndividualAssignmentAndPeriod() {
        var tasks = mock(TaskRepository.class);
        var members = mock(RestaurantMemberRepository.class);
        var old = member(17, position(1, RestaurantRole.MANAGER));
        var target = position(2, RestaurantRole.STAFF);
        var replacement = member(18, position(3, RestaurantRole.MANAGER));
        var task = Task.builder().id(10L).version(3L).title("Task").status(TaskStatus.ACTIVE)
                .assignedMember(old).assignedUser(old.getUser()).setterMember(old).build();
        when(tasks.findActiveResponsibilities(1L, 17L)).thenReturn(List.of(task));
        when(tasks.findAllForUpdate(1L, List.of(10L))).thenReturn(List.of(task));
        when(members.findWithUserAndPositionByIdAndRestaurantId(18L, 1L)).thenReturn(Optional.of(replacement));
        var handler = new TaskPositionChangeLifecycleHandler(tasks, members);
        handler.applyBeforePositionChange(context(old, target), new TaskPositionChangeLifecycleHandler.Decision(
                List.of(new TaskTransfer(10L, 3, 17L, 18L))));
        assertSame(replacement, task.getSetterMember());
        assertSame(old, task.getAssignedMember());
        assertSame(old.getUser(), task.getAssignedUser());
        assertEquals(now, old.getStartedAt());
        assertNull(old.getEndedAt());
        assertEquals(17L, old.getId());
    }

    @Test void staleSetterVersionFailsBeforeChangingTask() {
        var tasks = mock(TaskRepository.class);
        var members = mock(RestaurantMemberRepository.class);
        var old = member(17, position(1, RestaurantRole.MANAGER));
        var task = Task.builder().id(10L).version(4L).status(TaskStatus.ACTIVE).setterMember(old).build();
        when(tasks.findActiveResponsibilities(1L, 17L)).thenReturn(List.of(task));
        when(tasks.findAllForUpdate(1L, List.of(10L))).thenReturn(List.of(task));
        var handler = new TaskPositionChangeLifecycleHandler(tasks, members);
        var ex = assertThrows(ru.staffly.common.exception.ConflictException.class, () -> handler.applyBeforePositionChange(
                context(old, position(2, RestaurantRole.STAFF)), new TaskPositionChangeLifecycleHandler.Decision(
                        List.of(new TaskTransfer(10L, 3, 17L, 18L)))));
        assertTrue(ex.getMessage().contains("POSITION_CHANGE_PLAN_STALE"));
        assertSame(old, task.getSetterMember());
        verifyNoInteractions(members);
    }

    @Test void remainingManagerKeepsSetterWithoutDecision() {
        var tasks = mock(TaskRepository.class);
        var handler = new TaskPositionChangeLifecycleHandler(tasks, mock(RestaurantMemberRepository.class));
        var old = member(17, position(1, RestaurantRole.ADMIN));
        var p = handler.applyBeforePositionChange(context(old, position(2, RestaurantRole.MANAGER)),
                new TaskPositionChangeLifecycleHandler.Decision(List.of()));
        assertTrue(p.transfers().isEmpty());
        verify(tasks, never()).findActiveResponsibilities(anyLong(), anyLong());
    }

    @Test void checklistReleasesOnlyIneligibleReservationsAndKeepsCompletion() {
        var items = mock(ChecklistItemRepository.class);
        var old = member(17, position(1, RestaurantRole.STAFF));
        var target = position(2, RestaurantRole.STAFF);
        var inaccessible = ChecklistItem.builder().id(1L).reservedBy(old).reservedAt(now).doneBy(old).doneAt(now)
                .checklist(Checklist.builder().positions(Set.of(old.getPosition())).build()).build();
        var accessible = ChecklistItem.builder().id(2L).reservedBy(old).reservedAt(now)
                .checklist(Checklist.builder().positions(Set.of(old.getPosition(), target)).build()).build();
        when(items.findReservedForUpdate(17L)).thenReturn(List.of(inaccessible, accessible));
        var result = new ChecklistPositionChangeLifecycleHandler(items, mock(ru.staffly.checklist.repository.ChecklistRepository.class)).applyAfterPositionChange(
                context(old, target), new NoPositionChangeModuleDecision(LifecycleModule.CHECKLIST), null);
        assertEquals(1, result.releasedReservations());
        assertNull(inaccessible.getReservedBy());
        assertNull(inaccessible.getReservedAt());
        assertSame(old, inaccessible.getDoneBy());
        assertEquals(now, inaccessible.getDoneAt());
        assertSame(old, accessible.getReservedBy());
    }

    @Test void certificationEligibilityUsesResultingRoleCapabilityAndFullVisibility() {
        var policy = new TrainingPolicyService(mock(RestaurantMemberRepository.class), mock(PositionRepository.class),
                mock(ru.staffly.security.SecurityService.class));
        var admin = position(1, RestaurantRole.ADMIN);
        var manager = position(2, RestaurantRole.MANAGER);
        var staff = position(3, RestaurantRole.STAFF);
        assertFalse(policy.canOwnCertificationAsPosition(manager, Set.of(manager)));
        assertTrue(policy.canOwnCertificationAsPosition(admin, Set.of(manager, staff)));
        assertFalse(policy.canOwnCertificationAsPosition(staff, Set.of(staff)));
        staff.setSpecializations(Set.of(PositionSpecialization.EXAMINER));
        assertTrue(policy.canOwnCertificationAsPosition(staff, Set.of(admin, manager, staff)));
        staff.setSpecializations(Set.of());
        assertFalse(policy.canOwnCertificationAsPosition(staff, Set.of()));
    }

    @Test void materializingNewPositionNeverReusesHistoricalRow() {
        var current = member(17, position(2, RestaurantRole.STAFF));
        var schedule = Schedule.builder().id(1L).build();
        var historical = ScheduleRow.builder().id(10L).memberId(17L).positionId(1L).positionName("Old")
                .historical(true).schedule(schedule).build();
        schedule.getRows().add(historical);
        var participation = ScheduleParticipation.builder().member(current).positionId(2L).positionName("New").build();
        var row = new ScheduleRowMaterializer().ensureRowWithLocksHeld(schedule, current, participation);
        assertNotSame(historical, row);
        assertEquals(2, schedule.getRows().size());
        assertEquals("Old", historical.getPositionName());
        assertEquals("New", row.getPositionName());
        assertEquals(17L, row.getMemberId());
        assertFalse(row.isHistorical());
    }
}
