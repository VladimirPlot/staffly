package ru.staffly.master_schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.master_schedule.dto.*;
import ru.staffly.master_schedule.service.MasterScheduleService;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class MasterScheduleController {

    private final MasterScheduleService service;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/restaurants/{restaurantId}/master-schedules")
    public List<MasterScheduleSummaryDto> list(@PathVariable Long restaurantId,
                                               @AuthenticationPrincipal UserPrincipal principal) {
        return service.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/restaurants/{restaurantId}/master-schedules")
    public MasterScheduleDto create(@PathVariable Long restaurantId,
                                    @AuthenticationPrincipal UserPrincipal principal,
                                    @Valid @RequestBody MasterScheduleCreateRequest request) {
        return service.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/restaurants/{restaurantId}/master-schedules/{id}")
    public MasterScheduleDto get(@PathVariable Long restaurantId,
                                 @PathVariable Long id,
                                 @AuthenticationPrincipal UserPrincipal principal) {
        return service.get(id, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/restaurants/{restaurantId}/master-schedules/{id}")
    public MasterScheduleDto update(@PathVariable Long restaurantId,
                                    @PathVariable Long id,
                                    @AuthenticationPrincipal UserPrincipal principal,
                                    @RequestBody MasterScheduleUpdateRequest request) {
        return service.update(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/restaurants/{restaurantId}/master-schedules/{id}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long id,
                       @AuthenticationPrincipal UserPrincipal principal) {
        service.delete(id, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/restaurants/{restaurantId}/master-schedules/{id}/rows")
    public MasterScheduleRowDto createRow(@PathVariable Long restaurantId,
                                          @PathVariable Long id,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody MasterScheduleRowCreateRequest request) {
        return service.createRow(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/restaurants/{restaurantId}/master-schedules/{scheduleId}/rows/{rowId}")
    public MasterScheduleRowDto updateRow(@PathVariable Long restaurantId,
                                          @PathVariable Long scheduleId,
                                          @PathVariable Long rowId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @RequestBody MasterScheduleRowUpdateRequest request) {
        return service.updateRow(scheduleId, rowId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/restaurants/{restaurantId}/master-schedules/{scheduleId}/rows/{rowId}")
    public void deleteRow(@PathVariable Long restaurantId,
                          @PathVariable Long scheduleId,
                          @PathVariable Long rowId,
                          @AuthenticationPrincipal UserPrincipal principal) {
        service.deleteRow(scheduleId, rowId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/restaurants/{restaurantId}/master-schedules/{id}/cells:batch")
    public List<MasterScheduleCellDto> batchCells(@PathVariable Long restaurantId,
                                                  @PathVariable Long id,
                                                  @AuthenticationPrincipal UserPrincipal principal,
                                                  @Valid @RequestBody MasterScheduleCellBatchRequest request) {
        return service.batchUpdateCells(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/restaurants/{restaurantId}/master-schedules/{id}/week-template")
    public List<MasterScheduleWeekTemplateCellDto> getWeekTemplate(@PathVariable Long restaurantId,
                                                                   @PathVariable Long id,
                                                                   @AuthenticationPrincipal UserPrincipal principal) {
        return service.getWeekTemplate(id, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/restaurants/{restaurantId}/master-schedules/{id}/week-template:batch")
    public List<MasterScheduleWeekTemplateCellDto> batchWeekTemplate(@PathVariable Long restaurantId,
                                                                     @PathVariable Long id,
                                                                     @AuthenticationPrincipal UserPrincipal principal,
                                                                     @Valid @RequestBody MasterScheduleWeekTemplateBatchRequest request) {
        return service.batchUpdateWeekTemplateCells(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/restaurants/{restaurantId}/master-schedules/{id}/week-template/positions")
    public List<MasterScheduleWeekTemplateCellDto> addWeekTemplatePosition(@PathVariable Long restaurantId,
                                                                           @PathVariable Long id,
                                                                           @AuthenticationPrincipal UserPrincipal principal,
                                                                           @Valid @RequestBody MasterScheduleWeekTemplatePositionRequest request) {
        return service.addWeekTemplatePosition(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/restaurants/{restaurantId}/master-schedules/{id}/week-template/positions/{positionId}")
    public void deleteWeekTemplatePosition(@PathVariable Long restaurantId,
                                           @PathVariable Long id,
                                           @PathVariable Long positionId,
                                           @AuthenticationPrincipal UserPrincipal principal) {
        service.deleteWeekTemplatePosition(id, principal.userId(), positionId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/restaurants/{restaurantId}/master-schedules/{id}/week-template/apply")
    public void applyWeekTemplate(@PathVariable Long restaurantId,
                                  @PathVariable Long id,
                                  @AuthenticationPrincipal UserPrincipal principal,
                                  @Valid @RequestBody MasterScheduleApplyWeekTemplateRequest request) {
        service.applyWeekTemplate(id, principal.userId(), request);
    }
}
