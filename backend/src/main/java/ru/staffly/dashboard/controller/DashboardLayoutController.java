package ru.staffly.dashboard.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.dashboard.dto.DashboardLayoutRequest;
import ru.staffly.dashboard.dto.DashboardLayoutResponse;
import ru.staffly.dashboard.service.DashboardLayoutService;
import ru.staffly.security.UserPrincipal;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/dashboard/layout")
@RequiredArgsConstructor
public class DashboardLayoutController {

    private final DashboardLayoutService service;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public DashboardLayoutResponse getLayout(@PathVariable Long restaurantId,
                                             @AuthenticationPrincipal UserPrincipal principal) {
        return service.getLayout(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PutMapping
    public DashboardLayoutResponse updateLayout(@PathVariable Long restaurantId,
                                                @AuthenticationPrincipal UserPrincipal principal,
                                                @Valid @RequestBody DashboardLayoutRequest request) {
        return service.saveLayout(restaurantId, principal.userId(), request.getLayout());
    }
}