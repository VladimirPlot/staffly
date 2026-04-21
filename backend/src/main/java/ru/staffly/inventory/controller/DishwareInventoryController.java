package ru.staffly.inventory.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.inventory.dto.CreateDishwareInventoryRequest;
import ru.staffly.inventory.dto.DishwareInventoryDto;
import ru.staffly.inventory.dto.DishwareInventorySummaryDto;
import ru.staffly.inventory.dto.UpdateDishwareInventoryRequest;
import ru.staffly.inventory.service.DishwareInventoryService;
import ru.staffly.security.UserPrincipal;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/inventories/dishware")
@RequiredArgsConstructor
public class DishwareInventoryController {

    private final DishwareInventoryService service;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping
    public List<DishwareInventorySummaryDto> list(@PathVariable Long restaurantId,
                                                  @AuthenticationPrincipal UserPrincipal principal) {
        return service.list(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @GetMapping("/{inventoryId}")
    public DishwareInventoryDto get(@PathVariable Long restaurantId,
                                    @PathVariable Long inventoryId,
                                    @AuthenticationPrincipal UserPrincipal principal) {
        return service.get(restaurantId, principal.userId(), inventoryId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping
    public DishwareInventoryDto create(@PathVariable Long restaurantId,
                                       @AuthenticationPrincipal UserPrincipal principal,
                                       @Valid @RequestBody CreateDishwareInventoryRequest request) {
        return service.create(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/{inventoryId}")
    public DishwareInventoryDto update(@PathVariable Long restaurantId,
                                       @PathVariable Long inventoryId,
                                       @AuthenticationPrincipal UserPrincipal principal,
                                       @Valid @RequestBody UpdateDishwareInventoryRequest request) {
        return service.update(restaurantId, principal.userId(), inventoryId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{inventoryId}")
    public void delete(@PathVariable Long restaurantId,
                       @PathVariable Long inventoryId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        service.delete(restaurantId, principal.userId(), inventoryId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping(value = "/{inventoryId}/items/{itemId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DishwareInventoryDto uploadItemImage(@PathVariable Long restaurantId,
                                                @PathVariable Long inventoryId,
                                                @PathVariable Long itemId,
                                                @AuthenticationPrincipal UserPrincipal principal,
                                                @RequestParam("file") MultipartFile file) throws IOException {
        return service.uploadItemImage(restaurantId, principal.userId(), inventoryId, itemId, file);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/{inventoryId}/items/{itemId}/image")
    public DishwareInventoryDto deleteItemImage(@PathVariable Long restaurantId,
                                                @PathVariable Long inventoryId,
                                                @PathVariable Long itemId,
                                                @AuthenticationPrincipal UserPrincipal principal) throws IOException {
        return service.deleteItemImage(restaurantId, principal.userId(), inventoryId, itemId);
    }
}
