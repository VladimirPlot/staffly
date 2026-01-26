package ru.staffly.checklist.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistRequest;
import ru.staffly.checklist.service.ChecklistService;
import ru.staffly.security.UserPrincipal;

import java.util.List;


@RestController
@RequestMapping("/api/restaurants/{restaurantId}/checklists")
@RequiredArgsConstructor
public class ChecklistController {

    private final ChecklistService service;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public List<ChecklistDto> list(@PathVariable Long restaurantId,
                                   @AuthenticationPrincipal UserPrincipal principal,
                                   @RequestParam(name = "positionId", required = false) Long positionId) {
        return service.list(restaurantId, principal.userId(), principal.roles(), positionId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping
    public ChecklistDto create(@PathVariable Long restaurantId,
                               @AuthenticationPrincipal UserPrincipal principal,
                               @Valid @RequestBody ChecklistRequest request) {
        return service.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/{checklistId}")
    public ChecklistDto update(@PathVariable Long restaurantId,
                               @PathVariable Long checklistId,
                               @AuthenticationPrincipal UserPrincipal principal,
                               @Valid @RequestBody ChecklistRequest request) {
        return service.update(restaurantId, principal.userId(), checklistId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{checklistId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long checklistId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        service.delete(restaurantId, principal.userId(), checklistId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/{checklistId}/items/{itemId}/reserve")
    public ChecklistDto reserveItem(@PathVariable Long restaurantId,
                                    @PathVariable Long checklistId,
                                    @PathVariable Long itemId,
                                    @AuthenticationPrincipal UserPrincipal principal) {
        return service.reserveItem(restaurantId, principal.userId(), checklistId, itemId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/{checklistId}/items/{itemId}/unreserve")
    public ChecklistDto unreserveItem(@PathVariable Long restaurantId,
                                      @PathVariable Long checklistId,
                                      @PathVariable Long itemId,
                                      @AuthenticationPrincipal UserPrincipal principal) {
        return service.unreserveItem(restaurantId, principal.userId(), checklistId, itemId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/{checklistId}/items/{itemId}/complete")
    public ChecklistDto completeItem(@PathVariable Long restaurantId,
                                     @PathVariable Long checklistId,
                                     @PathVariable Long itemId,
                                     @AuthenticationPrincipal UserPrincipal principal) {
        return service.completeItem(restaurantId, principal.userId(), checklistId, itemId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/{checklistId}/items/{itemId}/undo")
    public ChecklistDto undoItem(@PathVariable Long restaurantId,
                                 @PathVariable Long checklistId,
                                 @PathVariable Long itemId,
                                 @AuthenticationPrincipal UserPrincipal principal) {
        return service.undoItem(restaurantId, principal.userId(), checklistId, itemId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/{checklistId}/reset")
    public ChecklistDto reset(@PathVariable Long restaurantId,
                              @PathVariable Long checklistId,
                              @AuthenticationPrincipal UserPrincipal principal) {
        return service.reset(restaurantId, principal.userId(), checklistId);
    }
}