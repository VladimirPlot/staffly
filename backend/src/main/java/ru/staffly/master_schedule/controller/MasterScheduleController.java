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
    @GetMapping("/master-schedules/{id}")
    public MasterScheduleDto get(@PathVariable Long id,
                                 @RequestParam Long restaurantId,
                                 @AuthenticationPrincipal UserPrincipal principal) {
        return service.get(id, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/master-schedules/{id}")
    public MasterScheduleDto update(@PathVariable Long id,
                                    @RequestParam Long restaurantId,
                                    @AuthenticationPrincipal UserPrincipal principal,
                                    @RequestBody MasterScheduleUpdateRequest request) {
        return service.update(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/master-schedules/{id}")
    public void delete(@PathVariable Long id,
                       @RequestParam Long restaurantId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        service.delete(id, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/master-schedules/{id}/rows")
    public MasterScheduleRowDto createRow(@PathVariable Long id,
                                          @RequestParam Long restaurantId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody MasterScheduleRowCreateRequest request) {
        return service.createRow(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/master-schedules/rows/{rowId}")
    public MasterScheduleRowDto updateRow(@PathVariable Long rowId,
                                          @RequestParam Long restaurantId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @RequestBody MasterScheduleRowUpdateRequest request) {
        return service.updateRow(rowId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/master-schedules/rows/{rowId}")
    public void deleteRow(@PathVariable Long rowId,
                          @RequestParam Long restaurantId,
                          @AuthenticationPrincipal UserPrincipal principal) {
        service.deleteRow(rowId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/master-schedules/{id}/cells:batch")
    public List<MasterScheduleCellDto> batchCells(@PathVariable Long id,
                                                  @RequestParam Long restaurantId,
                                                  @AuthenticationPrincipal UserPrincipal principal,
                                                  @Valid @RequestBody MasterScheduleCellBatchRequest request) {
        return service.batchUpdateCells(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/master-schedules/{id}/copy-day")
    public void copyDay(@PathVariable Long id,
                        @RequestParam Long restaurantId,
                        @AuthenticationPrincipal UserPrincipal principal,
                        @Valid @RequestBody MasterScheduleCopyDayRequest request) {
        service.copyDay(id, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/master-schedules/{id}/copy-week")
    public void copyWeek(@PathVariable Long id,
                         @RequestParam Long restaurantId,
                         @AuthenticationPrincipal UserPrincipal principal,
                         @Valid @RequestBody MasterScheduleCopyWeekRequest request) {
        service.copyWeek(id, principal.userId(), request);
    }
}