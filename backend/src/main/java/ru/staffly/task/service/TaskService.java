package ru.staffly.task.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.task.dto.*;
import ru.staffly.task.model.Task;
import ru.staffly.task.model.TaskComment;
import ru.staffly.task.model.TaskPriority;
import ru.staffly.task.model.TaskStatus;
import ru.staffly.task.repository.TaskCommentRepository;
import ru.staffly.task.repository.TaskRepository;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TaskService {

    public enum TaskScope {
        MINE,
        ALL
    }

    private final TaskRepository tasks;
    private final TaskCommentRepository comments;
    private final RestaurantRepository restaurants;
    private final RestaurantMemberRepository members;
    private final PositionRepository positions;
    private final UserRepository users;
    private final InboxMessageService inboxMessages;
    private final RestaurantTimeService restaurantTime;
    private final SecurityService securityService;
    private final RestaurantLifecycleMutex lifecycleMutex;

    @Transactional(readOnly = true)
    public List<TaskDto> list(Long restaurantId,
                              Long userId,
                              TaskScope scope,
                              TaskStatus status,
                              Boolean overdue) {
        securityService.assertMember(userId, restaurantId);
        RestaurantMember member = resolveMember(userId, restaurantId);
        boolean isManager = isManager(member);
        boolean viewAll = isManager && scope == TaskScope.ALL;
        Long positionId = member.getPosition() == null ? null : member.getPosition().getId();

        boolean overdueFilter = Boolean.TRUE.equals(overdue);
        LocalDate today = restaurantTime.today(restaurantId);
        List<Task> tasksList = tasks.findActiveByFilters(
                restaurantId,
                member.getId(),
                positionId,
                viewAll,
                status,
                overdueFilter,
                today
        );

        return tasksList.stream()
                .map(task -> toDto(task, task.getAssignedMember(), task.getSetterMember()))
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskDto get(Long taskId, Long userId) {
        Task task = tasks.findActiveById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        securityService.assertMember(userId, task.getRestaurant().getId());
        RestaurantMember member = resolveMember(userId, task.getRestaurant().getId());
        if (!isManager(member) && !isVisibleForMember(task, member)) {
            throw new NotFoundException("Task not found: " + taskId);
        }
        return toDto(task, task.getAssignedMember(), task.getSetterMember());
    }

    @Transactional
    public TaskDto create(Long restaurantId, Long userId, TaskCreateRequest request) {
        lifecycleMutex.lock(restaurantId);
        securityService.assertAtLeastManager(userId, restaurantId);
        RestaurantMember creatorMembership = members.findActiveByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Operational tasks require an active restaurant membership"));
        if (!isManager(creatorMembership)) {
            throw new ForbiddenException("Only an employed MANAGER or ADMIN can create tasks");
        }
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        User creator = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        String title = normalize(request.title());
        if (title == null || title.isBlank()) {
            throw new BadRequestException("Название обязательно");
        }

        TaskPriority priority = parsePriority(request.priority());
        LocalDate dueDate = parseDueDate(request.dueDate(), restaurant);
        String description = normalize(request.description());
        if (description != null && description.isBlank()) {
            description = null;
        }

        boolean assignedToAll = Boolean.TRUE.equals(request.assignedToAll());
        Long assignedUserId = request.assignedUserId();
        Long assignedPositionId = request.assignedPositionId();

        // assignedToAll является доминирующим и взаимоисключающим с assignedUserId/assignedPositionId.
        if (assignedToAll && (assignedUserId != null || assignedPositionId != null)) {
            throw new BadRequestException("Нельзя одновременно назначить всем и конкретному ответственному");
        }
        if (assignedUserId != null && assignedPositionId != null) {
            throw new BadRequestException("Нужно выбрать только одного ответственного");
        }

        User assignedUser = null;
        RestaurantMember assignedMember = null;
        Position assignedPosition = null;
        List<RestaurantMember> targets = List.of();

        if (assignedUserId != null) {
            assignedUser = users.findById(assignedUserId)
                    .orElseThrow(() -> new BadRequestException("Сотрудник не найден"));
            RestaurantMember resolved = members.findActiveByUserIdAndRestaurantId(assignedUserId, restaurantId)
                    .orElseThrow(() -> new BadRequestException("Сотрудник не найден в ресторане"));
            assignedMember = members.findForUpdateByIdAndRestaurantId(resolved.getId(), restaurantId)
                    .orElseThrow(() -> new BadRequestException("Сотрудник больше не работает в ресторане"));
            targets = List.of(assignedMember);
        } else if (assignedPositionId != null) {
            assignedPosition = positions.findById(assignedPositionId)
                    .orElseThrow(() -> new BadRequestException("Должность не найдена"));
            if (!Objects.equals(assignedPosition.getRestaurant().getId(), restaurantId)) {
                throw new BadRequestException("Должность принадлежит другому ресторану");
            }
            targets = members.findByRestaurantIdAndPositionIdInAndEndedAtIsNull(restaurantId, List.of(assignedPositionId));
        } else if (assignedToAll) {
            targets = members.findByRestaurantIdAndEndedAtIsNull(restaurantId);
        }

        RestaurantMember setterMember = members.findForUpdateByIdAndRestaurantId(creatorMembership.getId(), restaurantId)
                .orElseThrow(() -> new BadRequestException("Task creator must have an active restaurant membership"));
        Task task = Task.builder()
                .restaurant(restaurant)
                .title(title)
                .description(description)
                .priority(priority)
                .dueDate(dueDate)
                .status(TaskStatus.ACTIVE)
                .assignedToAll(assignedToAll)
                .assignedUser(assignedUser)
                .assignedMember(assignedMember)
                .assignedPosition(assignedPosition)
                .createdBy(creator)
                .setterMember(setterMember)
                .build();

        task = tasks.save(task);

        if (!targets.isEmpty()) {
            String content = "Новая задача: " + title;
            inboxMessages.createEvent(
                    restaurant,
                    creator,
                    content,
                    InboxEventSubtype.TASK,
                    "task:" + task.getId(),
                    targets,
                    null
            );
        }

        return toDto(task, task.getAssignedMember(), task.getSetterMember());
    }

    @Transactional
    public TaskDto assign(Long taskId, Long userId, TaskAssignRequest request) {
        Long restaurantId = tasks.findRestaurantIdByActiveId(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        lifecycleMutex.lock(restaurantId);
        securityService.assertAtLeastManager(userId, restaurantId);
        RestaurantMember actor = members.findActiveByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Для назначения нужен действующий MANAGER или ADMIN"));
        if (!isManager(actor)) {
            throw new ForbiddenException("Для назначения нужен действующий MANAGER или ADMIN");
        }
        RestaurantMember target = members.findForUpdateByIdAndRestaurantId(request.memberId(), restaurantId)
                .orElseThrow(() -> new BadRequestException("Сотрудник больше не работает в ресторане. Обновите список."));
        Task task = tasks.findAllForUpdate(restaurantId, List.of(taskId)).stream().findFirst()
                .filter(candidate -> candidate.getDeletedAt() == null)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        if (!Objects.equals(request.expectedVersion(), task.getVersion())
                || task.getStatus() != TaskStatus.ACTIVE || task.isAssignedToAll()
                || task.getAssignedMember() != null || task.getAssignedUser() != null
                || task.getAssignedPosition() != null) {
            throw new ConflictException("Задача изменилась. Обновите её перед назначением.",
                    Map.of("code", "TASK_ASSIGNMENT_STALE"));
        }
        task.setAssignedMember(target);
        task.setAssignedUser(target.getUser());
        task = tasks.saveAndFlush(task);
        inboxMessages.createEvent(task.getRestaurant(), actor.getUser(), "Вам назначена задача: " + task.getTitle(),
                InboxEventSubtype.TASK, "task-assignment:" + task.getId() + ":" + task.getVersion(), List.of(target), null);
        return toDto(task, target, task.getSetterMember());
    }

    @Transactional
    public TaskDto complete(Long taskId, Long userId) {
        Task task = tasks.findActiveById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        securityService.assertMember(userId, task.getRestaurant().getId());
        RestaurantMember member = resolveMember(userId, task.getRestaurant().getId());
        if (!isManager(member) && !isVisibleForMember(task, member)) {
            throw new NotFoundException("Task not found: " + taskId);
        }
        if (task.getStatus() != TaskStatus.COMPLETED) {
            task.setStatus(TaskStatus.COMPLETED);
            task.setCompletedAt(TimeProvider.nowUtc());
            task = tasks.save(task);
        }
        return toDto(task, task.getAssignedMember(), task.getSetterMember());
    }

    @Transactional
    public void delete(Long taskId, Long userId) {
        Task task = tasks.findActiveById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        securityService.assertAtLeastManager(userId, task.getRestaurant().getId());
        if (task.getDeletedAt() == null) {
            task.setDeletedAt(TimeProvider.now());
            tasks.save(task);
        }
    }

    @Transactional
    public TaskCommentDto addComment(Long taskId, Long userId, TaskCommentRequest request) {
        Task task = tasks.findActiveById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        securityService.assertMember(userId, task.getRestaurant().getId());
        RestaurantMember member = resolveMember(userId, task.getRestaurant().getId());
        if (!isManager(member) && !isVisibleForMember(task, member)) {
            throw new NotFoundException("Task not found: " + taskId);
        }
        User author = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));
        TaskComment comment = TaskComment.builder()
                .task(task)
                .author(author)
                .text(normalize(request.text()))
                .build();
        comment = comments.save(comment);
        return toCommentDto(comment, member);
    }

    @Transactional(readOnly = true)
    public TaskCommentPageDto listComments(Long taskId, Long userId, int page, int size) {
        Task task = tasks.findActiveById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        securityService.assertMember(userId, task.getRestaurant().getId());
        RestaurantMember member = resolveMember(userId, task.getRestaurant().getId());
        if (!isManager(member) && !isVisibleForMember(task, member)) {
            throw new NotFoundException("Task not found: " + taskId);
        }
        var pageable = org.springframework.data.domain.PageRequest.of(
                Math.max(page, 0),
                Math.max(size, 1),
                org.springframework.data.domain.Sort.by("createdAt").ascending()
        );
        var commentPage = comments.findByTaskId(taskId, pageable);
        // Comments retain User actor identity; never borrow a later employment period.
        List<TaskCommentDto> items = commentPage.stream()
                .map(comment -> toCommentDto(comment, null))
                .toList();
        return new TaskCommentPageDto(
                items,
                commentPage.getNumber(),
                commentPage.getSize(),
                commentPage.getTotalElements(),
                commentPage.getTotalPages(),
                commentPage.hasNext()
        );
    }

    private TaskCommentDto toCommentDto(TaskComment comment, RestaurantMember authorMember) {
        TaskUserDto author = toUserDto(comment.getAuthor(), authorMember);
        return new TaskCommentDto(
                comment.getId(),
                comment.getTask().getId(),
                author,
                comment.getText(),
                comment.getCreatedAt() == null ? null : comment.getCreatedAt().toString()
        );
    }

    private TaskDto toDto(Task task, RestaurantMember assignedMember, RestaurantMember creatorMember) {
        // assignedToAll является доминирующим и подразумевает, что assignedUser/assignedPosition равны нулю.
        TaskPositionDto assignedPosition = task.getAssignedPosition() == null
                ? null
                : new TaskPositionDto(task.getAssignedPosition().getId(), task.getAssignedPosition().getName());
        TaskUserDto assignedUser = toUserDto(assignedMember == null ? null : assignedMember.getUser(), assignedMember);
        // Historical author must never borrow the current setter's position.
        TaskUserDto createdBy = toUserDto(task.getCreatedBy(), null);
        TaskUserDto setter = toUserDto(task.getSetterMember() == null ? null : task.getSetterMember().getUser(), creatorMember);

        return new TaskDto(
                task.getId(),
                task.getRestaurant().getId(),
                task.getTitle(),
                task.getDescription(),
                task.getPriority() == null ? null : task.getPriority().name(),
                task.getDueDate() == null ? null : task.getDueDate().toString(),
                task.getStatus() == null ? null : task.getStatus().name(),
                task.getCompletedAt() == null ? null : task.getCompletedAt().toString(),
                task.isAssignedToAll(),
                assignedPosition,
                assignedUser,
                createdBy,
                setter,
                task.getCreatedAt() == null ? null : task.getCreatedAt().toString(),
                task.getVersion()
        );
    }

    private TaskUserDto toUserDto(User user, RestaurantMember member) {
        if (user == null) {
            return null;
        }
        Long positionId = null;
        String positionName = null;
        if (member != null && member.getPosition() != null) {
            positionId = member.getPosition().getId();
            positionName = member.getPosition().getName();
        }
        return new TaskUserDto(
                user.getId(),
                user.getFullName() + (member != null && !member.isActive() ? " (исключен)" : ""),
                user.getFirstName(),
                user.getLastName(),
                positionId,
                positionName
        );
    }

    private RestaurantMember resolveMember(Long userId, Long restaurantId) {
        return members.findActiveByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));
    }

    private boolean isManager(RestaurantMember member) {
        if (member == null || member.getRole() == null) {
            return false;
        }
        return member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;
    }

    private boolean isVisibleForMember(Task task, RestaurantMember member) {
        if (task.getAudience() != ru.staffly.task.model.TaskAudience.NONE) return TaskBoardService.visible(task, member);
        if (TaskBoardService.visible(task, member)) return true;
        if (task.getCompletionMode() == ru.staffly.task.model.TaskCompletionMode.EACH) return false;
        if (task.isAssignedToAll()) {
            return true;
        }
        if (member == null) {
            return false;
        }
        if (task.getAssignedMember() != null && Objects.equals(task.getAssignedMember().getId(), member.getId())) {
            return true;
        }
        if (task.getAssignedPosition() != null && member.getPosition() != null) {
            return Objects.equals(task.getAssignedPosition().getId(), member.getPosition().getId());
        }
        return false;
    }

    private TaskPriority parsePriority(String value) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException("Нужно указать приоритет");
        }
        try {
            return TaskPriority.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Некорректный приоритет");
        }
    }

    private LocalDate parseDueDate(String value, Restaurant restaurant) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException("Нужно указать срок");
        }
        try {
            LocalDate date = LocalDate.parse(value.trim());
            LocalDate today = restaurantTime.today(restaurant);
            if (date.isBefore(today)) {
                throw new BadRequestException("Срок не может быть в прошлом");
            }
            return date;
        } catch (DateTimeParseException ex) {
            throw new BadRequestException("Некорректный срок");
        }
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}
