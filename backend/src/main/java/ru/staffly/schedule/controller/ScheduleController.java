package ru.staffly.schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.schedule.dto.SaveScheduleRequest;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.schedule.dto.ScheduleSummaryDto;
import ru.staffly.schedule.service.ScheduleService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService schedules;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules")
    public ScheduleDto create(@PathVariable Long restaurantId,
                              @AuthenticationPrincipal UserPrincipal principal,
                              @Valid @RequestBody SaveScheduleRequest request) {
        return schedules.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/schedules")
    public List<ScheduleSummaryDto> list(@PathVariable Long restaurantId,
                                         @AuthenticationPrincipal UserPrincipal principal) {
        return schedules.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/schedules/{scheduleId}")
    public ScheduleDto get(@PathVariable Long restaurantId,
                           @PathVariable Long scheduleId,
                           @AuthenticationPrincipal UserPrincipal principal) {
        return schedules.get(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/schedules/{scheduleId}")
    public ScheduleDto update(@PathVariable Long restaurantId,
                              @PathVariable Long scheduleId,
                              @AuthenticationPrincipal UserPrincipal principal,
                              @Valid @RequestBody SaveScheduleRequest request) {
        return schedules.update(restaurantId, scheduleId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/schedules/{scheduleId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long scheduleId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        schedules.delete(restaurantId, scheduleId, principal.userId());
    }
}