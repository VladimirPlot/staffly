package ru.staffly.schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import ru.staffly.schedule.dto.ChangeScheduleOwnerRequest;
import ru.staffly.schedule.dto.ReassignScheduleOwnersRequest;
import ru.staffly.schedule.dto.SaveScheduleRequest;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.schedule.dto.ScheduleOwnerDto;
import ru.staffly.schedule.dto.ScheduleOwnerReassignmentOptionDto;
import ru.staffly.schedule.dto.ScheduleSummaryDto;
import ru.staffly.schedule.service.ScheduleOwnershipService;
import ru.staffly.schedule.service.ScheduleService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService schedules;
    private final ScheduleOwnershipService scheduleOwnershipService;

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
    @GetMapping("/schedules/{scheduleId}/owner-candidates")
    public List<ScheduleOwnerDto> getOwnerCandidates(@PathVariable Long restaurantId,
                                                     @PathVariable Long scheduleId,
                                                     @AuthenticationPrincipal UserPrincipal principal) {
        return scheduleOwnershipService.getOwnerCandidates(restaurantId, principal.userId(), scheduleId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/schedules/{scheduleId}/owner")
    public ScheduleDto changeOwner(@PathVariable Long restaurantId,
                                   @PathVariable Long scheduleId,
                                   @AuthenticationPrincipal UserPrincipal principal,
                                   @Valid @RequestBody ChangeScheduleOwnerRequest request) {
        scheduleOwnershipService.changeOwner(restaurantId, principal.userId(), scheduleId, request.ownerUserId());
        return schedules.get(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/schedules/owners/{ownerUserId}/reassignment-options")
    public List<ScheduleOwnerReassignmentOptionDto> getReassignmentOptions(@PathVariable Long restaurantId,
                                                                           @PathVariable Long ownerUserId,
                                                                           @AuthenticationPrincipal UserPrincipal principal) {
        return scheduleOwnershipService.getReassignmentOptions(restaurantId, principal.userId(), ownerUserId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules/owners/{ownerUserId}/reassign")
    public ResponseEntity<Void> reassignOwners(@PathVariable Long restaurantId,
                                               @PathVariable Long ownerUserId,
                                               @AuthenticationPrincipal UserPrincipal principal,
                                               @Valid @RequestBody ReassignScheduleOwnersRequest request) {
        scheduleOwnershipService.reassignOwnedSchedules(
                restaurantId,
                principal.userId(),
                ownerUserId,
                request.ownerUserIdsByScheduleId()
        );
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/schedules/{scheduleId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long scheduleId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        schedules.delete(restaurantId, scheduleId, principal.userId());
    }
}