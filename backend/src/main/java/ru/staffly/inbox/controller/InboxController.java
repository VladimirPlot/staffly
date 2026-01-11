package ru.staffly.inbox.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.inbox.dto.InboxPageDto;
import ru.staffly.inbox.dto.InboxMarkerDto;
import ru.staffly.inbox.dto.InboxUnreadCountDto;
import ru.staffly.inbox.service.InboxService;
import ru.staffly.security.UserPrincipal;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/inbox")
@RequiredArgsConstructor
public class InboxController {

    private final InboxService inbox;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public InboxPageDto list(@PathVariable Long restaurantId,
                             @RequestParam(defaultValue = "ANNOUNCEMENT") InboxService.InboxTab tab,
                             @RequestParam(defaultValue = "UNREAD") InboxService.InboxView view,
                             @RequestParam(defaultValue = "0") int page,
                             @RequestParam(defaultValue = "20") int size,
                             @AuthenticationPrincipal UserPrincipal principal) {
        return inbox.list(restaurantId, principal.userId(), tab, view, page, size);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/unread-count")
    public InboxUnreadCountDto unreadCount(@PathVariable Long restaurantId,
                                           @AuthenticationPrincipal UserPrincipal principal) {
        return inbox.unreadCount(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/markers")
    public InboxMarkerDto markers(@PathVariable Long restaurantId,
                                  @AuthenticationPrincipal UserPrincipal principal) {
        return inbox.markers(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/{messageId}/read")
    public void markRead(@PathVariable Long restaurantId,
                         @PathVariable Long messageId,
                         @AuthenticationPrincipal UserPrincipal principal) {
        inbox.markRead(restaurantId, principal.userId(), messageId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/{messageId}/archive")
    public void archive(@PathVariable Long restaurantId,
                        @PathVariable Long messageId,
                        @AuthenticationPrincipal UserPrincipal principal) {
        inbox.archive(restaurantId, principal.userId(), messageId);
    }
}