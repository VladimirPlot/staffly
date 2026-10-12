package ru.staffly.common_schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.common_schedule.dto.*;
import ru.staffly.common_schedule.service.CommonScheduleService;
import ru.staffly.security.UserPrincipal;
import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/common-schedules")
@RequiredArgsConstructor
public class CommonScheduleController {
    private final CommonScheduleService service;

    @GetMapping
    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    public List<CommonScheduleSummaryDto> list(@PathVariable Long restaurantId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return service.list(restaurantId, principal.userId());
    }

    @GetMapping("/{id}")
    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    public CommonScheduleDto get(@PathVariable Long restaurantId, @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        return service.get(restaurantId, id, principal.userId());
    }

    @PostMapping
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    public CommonScheduleDto create(@PathVariable Long restaurantId,
            @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody CommonScheduleRequest request) {
        return service.create(restaurantId, principal.userId(), request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    public CommonScheduleDto update(@PathVariable Long restaurantId, @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody CommonScheduleRequest request) {
        return service.update(restaurantId, id, principal.userId(), request);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    public void delete(@PathVariable Long restaurantId, @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal, @RequestParam Long version) {
        service.delete(restaurantId, id, principal.userId(), version);
    }
}
