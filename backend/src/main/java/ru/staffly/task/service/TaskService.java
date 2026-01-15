package ru.staffly.task.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
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
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

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

        List<Task> tasksList = tasks.findActiveByRestaurantId(restaurantId);
        if (!viewAll) {
            tasksList = tasksList.stream()
                    .filter(task -> isVisibleForMember(task, member))
                    .toList();
        }

        if (status != null) {
            tasksList = tasksList.stream()
                    .filter(task -> task.getStatus() == status)
                    .toList();
        }

        if (Boolean.TRUE.equals(overdue)) {
            LocalDate today = restaurantTime.today(restaurantId);
            tasksList = tasksList.stream()
                    .filter(task -> task.getDueDate() != null && task.getDueDate().isBefore(today))
                    .toList();
        }

        Map<Long, RestaurantMember> memberByUser = members.findByRestaurantId(restaurantId)
                .stream()
                .collect(Collectors.toMap(
                        m -> m.getUser().getId(),
                        m -> m,
                        (first, second) -> first
                ));

        Comparator<Task> comparator = Comparator
                .comparing((Task task) -> priorityWeight(task.getPriority()))
                .thenComparing(task -> task.getDueDate(), Comparator.nullsLast(Comparator.naturalOrder()));

        return tasksList.stream()
                .sorted(comparator)
                .map(task -> toDto(task, memberByUser.get(task.getAssignedUser() != null ? task.getAssignedUser().getId() : null),
                        memberByUser.get(task.getCreatedBy() != null ? task.getCreatedBy().getId() : null)))
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
        RestaurantMember assignedMember = resolveMemberOrNull(task.getAssignedUser(), task.getRestaurant().getId());
        RestaurantMember creatorMember = resolveMemberOrNull(task.getCreatedBy(), task.getRestaurant().getId());
        return toDto(task, assignedMember, creatorMember);
    }

    @Transactional
    public TaskDto create(Long restaurantId, Long userId, TaskCreateRequest request) {
        securityService.assertAtLeastManager(userId, restaurantId);
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

        if (assignedToAll && (assignedUserId != null || assignedPositionId != null)) {
            throw new BadRequestException("Нельзя одновременно назначить всем и конкретному ответственному");
        }
        if (assignedUserId != null && assignedPositionId != null) {
            throw new BadRequestException("Нужно выбрать только одного ответственного");
        }

        User assignedUser = null;
        Position assignedPosition = null;
        List<RestaurantMember> targets = List.of();

        if (assignedUserId != null) {
            assignedUser = users.findById(assignedUserId)
                    .orElseThrow(() -> new BadRequestException("Сотрудник не найден"));
            RestaurantMember assignedMember = members.findByUserIdAndRestaurantId(assignedUserId, restaurantId)
                    .orElseThrow(() -> new BadRequestException("Сотрудник не найден в ресторане"));
            targets = List.of(assignedMember);
        } else if (assignedPositionId != null) {
            assignedPosition = positions.findById(assignedPositionId)
                    .orElseThrow(() -> new BadRequestException("Должность не найдена"));
            if (!Objects.equals(assignedPosition.getRestaurant().getId(), restaurantId)) {
                throw new BadRequestException("Должность принадлежит другому ресторану");
            }
            targets = members.findByRestaurantIdAndPositionIdIn(restaurantId, List.of(assignedPositionId));
        } else if (assignedToAll) {
            targets = members.findByRestaurantId(restaurantId);
        }

        Task task = Task.builder()
                .restaurant(restaurant)
                .title(title)
                .description(description)
                .priority(priority)
                .dueDate(dueDate)
                .status(TaskStatus.ACTIVE)
                .assignedToAll(assignedToAll)
                .assignedUser(assignedUser)
                .assignedPosition(assignedPosition)
                .createdBy(creator)
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

        RestaurantMember assignedMember = resolveMemberOrNull(task.getAssignedUser(), restaurantId);
        RestaurantMember creatorMember = resolveMemberOrNull(task.getCreatedBy(), restaurantId);
        return toDto(task, assignedMember, creatorMember);
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
        RestaurantMember assignedMember = resolveMemberOrNull(task.getAssignedUser(), task.getRestaurant().getId());
        RestaurantMember creatorMember = resolveMemberOrNull(task.getCreatedBy(), task.getRestaurant().getId());
        return toDto(task, assignedMember, creatorMember);
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
    public List<TaskCommentDto> listComments(Long taskId, Long userId) {
        Task task = tasks.findActiveById(taskId)
                .orElseThrow(() -> new NotFoundException("Task not found: " + taskId));
        securityService.assertMember(userId, task.getRestaurant().getId());
        RestaurantMember member = resolveMember(userId, task.getRestaurant().getId());
        if (!isManager(member) && !isVisibleForMember(task, member)) {
            throw new NotFoundException("Task not found: " + taskId);
        }
        List<TaskComment> commentList = comments.findByTaskId(taskId);
        Map<Long, RestaurantMember> memberByUser = members.findByRestaurantId(task.getRestaurant().getId())
                .stream()
                .collect(Collectors.toMap(
                        m -> m.getUser().getId(),
                        m -> m,
                        (first, second) -> first
                ));
        return commentList.stream()
                .map(comment -> toCommentDto(comment, memberByUser.get(comment.getAuthor().getId())))
                .toList();
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
        TaskPositionDto assignedPosition = task.getAssignedPosition() == null
                ? null
                : new TaskPositionDto(task.getAssignedPosition().getId(), task.getAssignedPosition().getName());
        TaskUserDto assignedUser = toUserDto(task.getAssignedUser(), assignedMember);
        TaskUserDto createdBy = toUserDto(task.getCreatedBy(), creatorMember);

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
                task.getCreatedAt() == null ? null : task.getCreatedAt().toString()
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
                user.getFullName(),
                user.getFirstName(),
                user.getLastName(),
                positionId,
                positionName
        );
    }

    private RestaurantMember resolveMember(Long userId, Long restaurantId) {
        return members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));
    }

    private RestaurantMember resolveMemberOrNull(User user, Long restaurantId) {
        if (user == null) {
            return null;
        }
        return members.findByUserIdAndRestaurantId(user.getId(), restaurantId).orElse(null);
    }

    private boolean isManager(RestaurantMember member) {
        if (member == null || member.getRole() == null) {
            return false;
        }
        return member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;
    }

    private boolean isVisibleForMember(Task task, RestaurantMember member) {
        if (task.isAssignedToAll()) {
            return true;
        }
        if (member == null) {
            return false;
        }
        if (task.getAssignedUser() != null && Objects.equals(task.getAssignedUser().getId(), member.getUser().getId())) {
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

    private int priorityWeight(TaskPriority priority) {
        if (priority == null) {
            return 99;
        }
        return switch (priority) {
            case HIGH -> 0;
            case MEDIUM -> 1;
            case LOW -> 2;
        };
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}