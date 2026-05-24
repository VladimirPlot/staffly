package ru.staffly.inventory.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.inventory.dto.InventoryLayoutRequest;
import ru.staffly.inventory.dto.InventoryLayoutResponse;
import ru.staffly.inventory.service.InventoryLayoutService;
import ru.staffly.security.UserPrincipal;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/inventories/layout")
@RequiredArgsConstructor
public class InventoryLayoutController {

    private final InventoryLayoutService service;

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping
    public InventoryLayoutResponse getLayout(@PathVariable Long restaurantId,
                                             @AuthenticationPrincipal UserPrincipal principal) {
        return service.getLayout(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PutMapping
    public InventoryLayoutResponse updateLayout(@PathVariable Long restaurantId,
                                                @AuthenticationPrincipal UserPrincipal principal,
                                                @Valid @RequestBody InventoryLayoutRequest request) {
        return service.saveLayout(restaurantId, principal.userId(), request.getLayout());
    }
}
