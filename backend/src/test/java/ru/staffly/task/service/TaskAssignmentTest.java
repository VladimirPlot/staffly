package ru.staffly.task.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.EnumSource;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.task.dto.TaskAssignRequest;
import ru.staffly.task.model.*;
import ru.staffly.task.repository.*;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TaskAssignmentTest {
    private final TaskRepository tasks = mock(TaskRepository.class);
    private final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    private final InboxMessageService inbox = mock(InboxMessageService.class);
    private final SecurityService security = mock(SecurityService.class);
    private final RestaurantLifecycleMutex mutex = mock(RestaurantLifecycleMutex.class);
    private final Restaurant restaurant = Restaurant.builder().id(1L).build();
    private final RestaurantMember actor = member(10L, 100L, RestaurantRole.MANAGER);
    private final RestaurantMember target = member(20L, 200L, RestaurantRole.STAFF);
    private final Task task = Task.builder().id(30L).restaurant(restaurant).title("Orphan").version(4L)
            .status(TaskStatus.ACTIVE).createdBy(actor.getUser()).setterMember(actor).build();
    private final TaskService service = new TaskService(tasks, mock(TaskCommentRepository.class),
            mock(RestaurantRepository.class), members, mock(PositionRepository.class), mock(UserRepository.class),
            inbox, mock(RestaurantTimeService.class), security, mutex);

    private RestaurantMember member(Long id, Long userId, RestaurantRole role) {
        return RestaurantMember.builder().id(id).restaurant(restaurant)
                .position(Position.builder().id(id).name(role.name()).level(role).build())
                .user(User.builder().id(userId).firstName("Test").lastName("User").build()).build();
    }

    @BeforeEach void stub() {
        when(tasks.findRestaurantIdByActiveId(30L)).thenReturn(Optional.of(1L));
        when(members.findActiveByUserIdAndRestaurantId(100L, 1L)).thenReturn(Optional.of(actor));
        when(members.findForUpdateByIdAndRestaurantId(20L, 1L)).thenReturn(Optional.of(target));
        when(tasks.findAllForUpdate(1L, List.of(30L))).thenReturn(List.of(task));
        when(tasks.saveAndFlush(task)).thenAnswer(invocation -> { task.setVersion(task.getVersion() + 1); return task; });
    }
    private void assign() { service.assign(30L, 100L, new TaskAssignRequest(20L, 4L)); }
    private void noWrite() {
        verify(tasks, never()).saveAndFlush(any());
        verifyNoInteractions(inbox);
    }

    @ParameterizedTest @EnumSource(value = RestaurantRole.class, names = {"MANAGER", "ADMIN"})
    void assignmentPreservesResponsibilityAndHistoryAndNotifiesExactlyOnce(RestaurantRole role) {
        actor.getPosition().setLevel(role);
        var dto = service.assign(30L, 100L, new TaskAssignRequest(20L, 4L));
        assertSame(target, task.getAssignedMember());
        assertSame(target.getUser(), task.getAssignedUser());
        assertSame(actor, task.getSetterMember());
        assertSame(actor.getUser(), task.getCreatedBy());
        assertEquals(TaskStatus.ACTIVE, task.getStatus());
        assertEquals(5, dto.version());
        assertEquals(200L, dto.assignedUser().id());
        assertThrows(ConflictException.class, this::assign);
        verify(inbox).createEvent(restaurant, actor.getUser(), "Вам назначена задача: Orphan",
                InboxEventSubtype.TASK, "task-assignment:30:5", List.of(target), null);
        verify(tasks, times(1)).saveAndFlush(task);
        var order = inOrder(mutex, members, tasks);
        order.verify(mutex).lock(1L);
        order.verify(members).findActiveByUserIdAndRestaurantId(100L, 1L);
        order.verify(members).findForUpdateByIdAndRestaurantId(20L, 1L);
        order.verify(tasks).findAllForUpdate(1L, List.of(30L));
    }

    @ParameterizedTest @ValueSource(strings = {"version", "complete", "all", "position", "member", "legacyUser"})
    void staleOrNonOrphanTasksCannotBeOverwritten(String change) {
        switch (change) {
            case "version" -> task.setVersion(5L);
            case "complete" -> task.setStatus(TaskStatus.COMPLETED);
            case "all" -> task.setAssignedToAll(true);
            case "position" -> task.setAssignedPosition(target.getPosition());
            case "member" -> task.setAssignedMember(target);
            case "legacyUser" -> task.setAssignedUser(target.getUser());
        }
        assertEquals("TASK_ASSIGNMENT_STALE", assertThrows(ConflictException.class, this::assign).getMeta().get("code"));
        noWrite();
    }

    @Test void staffCannotAssign() {
        actor.getPosition().setLevel(RestaurantRole.STAFF);
        assertThrows(ForbiddenException.class, this::assign);
        noWrite();
        verify(members, never()).findForUpdateByIdAndRestaurantId(any(), any());
    }

    @Test void creatorWithoutEmploymentCannotAssignEvenWithGlobalAuthority() {
        when(members.findActiveByUserIdAndRestaurantId(100L, 1L)).thenReturn(Optional.empty());
        assertThrows(ForbiddenException.class, this::assign);
        noWrite();
    }

    @Test void endedOrCrossRestaurantMemberCannotBeAssignedAndOldIdDoesNotFollowRehire() {
        when(members.findForUpdateByIdAndRestaurantId(20L, 1L)).thenReturn(Optional.empty());
        assertThrows(BadRequestException.class, this::assign);
        assertNull(task.getAssignedMember());
        noWrite();
        verify(members, never()).findActiveByUserIdAndRestaurantId(200L, 1L);
    }

    @Test void taskDeletedWhileWaitingIsRejected() {
        task.setDeletedAt(Instant.now());
        assertThrows(NotFoundException.class, this::assign);
        noWrite();
    }
}
