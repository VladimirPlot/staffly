package ru.staffly.schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.schedule.dto.CreateReplacementShiftRequest;
import ru.staffly.schedule.dto.CreateSwapShiftRequest;
import ru.staffly.schedule.dto.ShiftDecisionRequest;
import ru.staffly.schedule.dto.ShiftRequestDto;
import ru.staffly.schedule.service.ScheduleShiftRequestService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/schedules/{scheduleId}/shift-requests")
@RequiredArgsConstructor
public class ScheduleShiftRequestController {

    private final ScheduleShiftRequestService service;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/replacement")
    public ShiftRequestDto createReplacement(@PathVariable Long restaurantId,
                                             @PathVariable Long scheduleId,
                                             @AuthenticationPrincipal UserPrincipal principal,
                                             @Valid @RequestBody CreateReplacementShiftRequest request) {
        return service.createReplacement(restaurantId, scheduleId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/swap")
    public ShiftRequestDto createSwap(@PathVariable Long restaurantId,
                                      @PathVariable Long scheduleId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody CreateSwapShiftRequest request) {
        return service.createSwap(restaurantId, scheduleId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public List<ShiftRequestDto> list(@PathVariable Long restaurantId,
                                      @PathVariable Long scheduleId,
                                      @AuthenticationPrincipal UserPrincipal principal) {
        return service.listForSchedule(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/{id}/target-decision")
    public ShiftRequestDto targetDecision(@PathVariable Long restaurantId,
                                          @PathVariable Long scheduleId,
                                          @PathVariable Long id,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody ShiftDecisionRequest request) {
        return service.decideAsTarget(restaurantId, id, principal.userId(), request.accepted());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/{id}/manager-decision")
    public ShiftRequestDto managerDecision(@PathVariable Long restaurantId,
                                           @PathVariable Long scheduleId,
                                           @PathVariable Long id,
                                           @AuthenticationPrincipal UserPrincipal principal,
                                           @Valid @RequestBody ShiftDecisionRequest request) {
        return service.decideAsManager(restaurantId, id, principal.userId(), request.accepted());
    }
}