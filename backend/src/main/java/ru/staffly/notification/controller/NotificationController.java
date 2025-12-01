package ru.staffly.notification.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.notification.dto.NotificationDto;
import ru.staffly.notification.dto.NotificationRequest;
import ru.staffly.notification.service.NotificationService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notifications;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public List<NotificationDto> list(@PathVariable Long restaurantId,
                                      @AuthenticationPrincipal UserPrincipal principal) {
        return notifications.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping
    public NotificationDto create(@PathVariable Long restaurantId,
                                  @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody NotificationRequest request) {
        return notifications.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/{notificationId}")
    public NotificationDto update(@PathVariable Long restaurantId,
                                  @PathVariable Long notificationId,
                                  @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody NotificationRequest request) {
        return notifications.update(restaurantId, principal.userId(), notificationId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{notificationId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long notificationId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        notifications.delete(restaurantId, principal.userId(), notificationId);
    }
}