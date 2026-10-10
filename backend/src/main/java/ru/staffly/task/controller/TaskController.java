package ru.staffly.task.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.security.UserPrincipal;
import ru.staffly.task.dto.TaskCommentDto;
import ru.staffly.task.dto.TaskCommentPageDto;
import ru.staffly.task.dto.TaskCommentRequest;
import ru.staffly.task.dto.TaskCreateRequest;
import ru.staffly.task.dto.TaskAssignRequest;
import ru.staffly.task.dto.TaskDto;
import ru.staffly.task.model.TaskStatus;
import ru.staffly.task.service.TaskService;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService service;
    private final ru.staffly.task.service.TaskBoardService board;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/restaurants/{restaurantId}/tasks")
    public List<TaskDto> list(@PathVariable Long restaurantId,
                              @AuthenticationPrincipal UserPrincipal principal,
                              @RequestParam(name = "scope", defaultValue = "MINE") TaskService.TaskScope scope,
                              @RequestParam(name = "status", required = false) TaskStatus status,
                              @RequestParam(name = "overdue", required = false) Boolean overdue) {
        return board.list(restaurantId, principal.userId(), scope, status, overdue);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/restaurants/{restaurantId}/tasks")
    public TaskDto create(@PathVariable Long restaurantId,
                          @AuthenticationPrincipal UserPrincipal principal,
                          @Valid @RequestBody ru.staffly.task.dto.TaskWriteRequest request) {
        return board.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tasks/{taskId}")
    public TaskDto get(@PathVariable Long taskId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        return board.get(taskId, principal.userId());
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/tasks/{taskId}/assignee")
    public TaskDto assign(@PathVariable Long taskId,
                          @AuthenticationPrincipal UserPrincipal principal,
                          @Valid @RequestBody TaskAssignRequest request) {
        return board.assign(taskId, principal.userId(), request);
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/tasks/{taskId}/complete")
    public TaskDto complete(@PathVariable Long taskId,
                            @AuthenticationPrincipal UserPrincipal principal) {
        return board.complete(taskId, principal.userId(), false);
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/tasks/{taskId}")
    public TaskDto update(@PathVariable Long taskId, @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ru.staffly.task.dto.TaskWriteRequest request) {
        return board.update(taskId, principal.userId(), request);
    }
    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/tasks/{taskId}/undo-completion")
    public TaskDto undo(@PathVariable Long taskId, @AuthenticationPrincipal UserPrincipal principal) {
        return board.complete(taskId, principal.userId(), true);
    }
    public record ReopenRequest(@jakarta.validation.constraints.NotNull Long expectedVersion) {}
    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/tasks/{taskId}/reopen")
    public TaskDto reopen(@PathVariable Long taskId, @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ReopenRequest request) {
        return board.reopen(taskId, principal.userId(), request.expectedVersion());
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/tasks/{taskId}")
    public void delete(@PathVariable Long taskId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        board.delete(taskId, principal.userId());
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/tasks/{taskId}/comments")
    public TaskCommentDto addComment(@PathVariable Long taskId,
                                     @AuthenticationPrincipal UserPrincipal principal,
                                     @Valid @RequestBody TaskCommentRequest request) {
        return service.addComment(taskId, principal.userId(), request);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tasks/{taskId}/comments")
    public TaskCommentPageDto listComments(@PathVariable Long taskId,
                                           @AuthenticationPrincipal UserPrincipal principal,
                                           @RequestParam(name = "page", defaultValue = "0") int page,
                                           @RequestParam(name = "size", defaultValue = "10") int size) {
        return service.listComments(taskId, principal.userId(), page, size);
    }
}
