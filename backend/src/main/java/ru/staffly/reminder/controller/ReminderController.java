package ru.staffly.reminder.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.reminder.dto.ReminderDto;
import ru.staffly.reminder.dto.ReminderRequest;
import ru.staffly.reminder.service.ReminderService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/reminders")
@RequiredArgsConstructor
public class ReminderController {

    private final ReminderService service;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public List<ReminderDto> list(@PathVariable Long restaurantId,
                                  @AuthenticationPrincipal UserPrincipal principal,
                                  @RequestParam(name = "positionId", required = false) Long positionId) {
        return service.list(restaurantId, principal.userId(), principal.roles(), positionId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping
    public ReminderDto create(@PathVariable Long restaurantId,
                              @AuthenticationPrincipal UserPrincipal principal,
                              @Valid @RequestBody ReminderRequest request) {
        return service.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PutMapping("/{reminderId}")
    public ReminderDto update(@PathVariable Long restaurantId,
                              @PathVariable Long reminderId,
                              @AuthenticationPrincipal UserPrincipal principal,
                              @Valid @RequestBody ReminderRequest request) {
        return service.update(restaurantId, principal.userId(), reminderId, request);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @DeleteMapping("/{reminderId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long reminderId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        service.delete(restaurantId, principal.userId(), reminderId);
    }
}
