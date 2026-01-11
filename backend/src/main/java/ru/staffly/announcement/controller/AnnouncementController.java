package ru.staffly.announcement.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.announcement.dto.AnnouncementDto;
import ru.staffly.announcement.dto.AnnouncementRequest;
import ru.staffly.announcement.service.AnnouncementService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcements;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping
    public List<AnnouncementDto> list(@PathVariable Long restaurantId,
                                      @AuthenticationPrincipal UserPrincipal principal) {
        return announcements.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping
    public AnnouncementDto create(@PathVariable Long restaurantId,
                                  @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody AnnouncementRequest request) {
        return announcements.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/{announcementId}")
    public AnnouncementDto update(@PathVariable Long restaurantId,
                                  @PathVariable Long announcementId,
                                  @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody AnnouncementRequest request) {
        return announcements.update(restaurantId, principal.userId(), announcementId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{announcementId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long announcementId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        announcements.delete(restaurantId, principal.userId(), announcementId);
    }
}