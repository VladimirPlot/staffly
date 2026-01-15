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
import ru.staffly.task.dto.TaskDto;
import ru.staffly.task.model.TaskStatus;
import ru.staffly.task.service.TaskService;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService service;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/restaurants/{restaurantId}/tasks")
    public List<TaskDto> list(@PathVariable Long restaurantId,
                              @AuthenticationPrincipal UserPrincipal principal,
                              @RequestParam(name = "scope", defaultValue = "MINE") TaskService.TaskScope scope,
                              @RequestParam(name = "status", required = false) TaskStatus status,
                              @RequestParam(name = "overdue", required = false) Boolean overdue) {
        return service.list(restaurantId, principal.userId(), scope, status, overdue);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/restaurants/{restaurantId}/tasks")
    public TaskDto create(@PathVariable Long restaurantId,
                          @AuthenticationPrincipal UserPrincipal principal,
                          @Valid @RequestBody TaskCreateRequest request) {
        return service.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/tasks/{taskId}")
    public TaskDto get(@PathVariable Long taskId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        return service.get(taskId, principal.userId());
    }

    @PreAuthorize("isAuthenticated()")
    @PatchMapping("/tasks/{taskId}/complete")
    public TaskDto complete(@PathVariable Long taskId,
                            @AuthenticationPrincipal UserPrincipal principal) {
        return service.complete(taskId, principal.userId());
    }

    @PreAuthorize("isAuthenticated()")
    @DeleteMapping("/tasks/{taskId}")
    public void delete(@PathVariable Long taskId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        service.delete(taskId, principal.userId());
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