package ru.staffly.schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.schedule.dto.ChangeScheduleOwnerRequest;
import ru.staffly.schedule.dto.AddScheduleMemberRequest;
import ru.staffly.schedule.dto.AddableScheduleMemberDto;
import ru.staffly.schedule.dto.SaveScheduleRequest;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.schedule.dto.ScheduleOwnerDto;
import ru.staffly.schedule.dto.ScheduleSummaryDto;
import ru.staffly.schedule.dto.StartPreferenceCollectionRequest;
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

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules/drafts")
    public ScheduleDto createDraft(@PathVariable Long restaurantId,
                                   @AuthenticationPrincipal UserPrincipal principal,
                                   @Valid @RequestBody SaveScheduleRequest request) {
        return schedules.createDraft(restaurantId, principal.userId(), request);
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
    @GetMapping("/schedules/{scheduleId}/addable-members")
    public List<AddableScheduleMemberDto> getAddableMembers(@PathVariable Long restaurantId,
                                                             @PathVariable Long scheduleId,
                                                             @AuthenticationPrincipal UserPrincipal principal) {
        return schedules.getAddableMembers(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules/{scheduleId}/rows")
    public ScheduleDto addMember(@PathVariable Long restaurantId,
                                 @PathVariable Long scheduleId,
                                 @AuthenticationPrincipal UserPrincipal principal,
                                 @Valid @RequestBody AddScheduleMemberRequest request) {
        return schedules.addMember(restaurantId, scheduleId, principal.userId(), request.memberId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules/{scheduleId}/preferences/start")
    public ScheduleDto startPreferenceCollection(@PathVariable Long restaurantId,
                                                 @PathVariable Long scheduleId,
                                                 @AuthenticationPrincipal UserPrincipal principal,
                                                 @Valid @RequestBody StartPreferenceCollectionRequest request) {
        return schedules.startPreferenceCollection(restaurantId, scheduleId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules/{scheduleId}/preferences/close")
    public ScheduleDto closePreferenceCollection(@PathVariable Long restaurantId,
                                                 @PathVariable Long scheduleId,
                                                 @AuthenticationPrincipal UserPrincipal principal) {
        return schedules.closePreferenceCollection(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules/{scheduleId}/preferences/apply-simple")
    public ScheduleDto applyPreferencesSimple(@PathVariable Long restaurantId,
                                              @PathVariable Long scheduleId,
                                              @AuthenticationPrincipal UserPrincipal principal) {
        return schedules.applyPreferencesSimple(restaurantId, scheduleId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/schedules/{scheduleId}/publish")
    public ScheduleDto publish(@PathVariable Long restaurantId,
                               @PathVariable Long scheduleId,
                               @AuthenticationPrincipal UserPrincipal principal) {
        return schedules.publish(restaurantId, scheduleId, principal.userId());
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
    @DeleteMapping("/schedules/{scheduleId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long scheduleId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        schedules.delete(restaurantId, scheduleId, principal.userId());
    }
}
