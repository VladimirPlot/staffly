package ru.staffly.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.security.UserPrincipal;
import ru.staffly.training.dto.TrainingCategoryDto;
import ru.staffly.training.dto.TrainingItemDto;
import ru.staffly.training.model.TrainingModule;
import ru.staffly.training.service.TrainingService;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/training")
@RequiredArgsConstructor
public class TrainingController {

    private final TrainingService training;

    /* ===== CATEGORIES ===== */

    // Список категорий в модуле (MENU/BAR)
    // Параметр allForManagers=true позволяет ADMIN/MANAGER видеть все категории (игнорируя видимость по позициям)
    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/{module}/categories")
    public List<TrainingCategoryDto> listCategories(@PathVariable Long restaurantId,
                                                    @PathVariable TrainingModule module,
                                                    @AuthenticationPrincipal UserPrincipal principal,
                                                    @RequestParam(name = "allForManagers", defaultValue = "false") boolean allForManagers) {
        return training.listCategories(restaurantId, principal.userId(), module, allForManagers);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/{module}/categories")
    public TrainingCategoryDto createCategory(@PathVariable Long restaurantId,
                                              @PathVariable TrainingModule module,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody TrainingCategoryDto dto) {
        // модуль берём из пути, чтобы не полагаться на тело
        var fixed = new TrainingCategoryDto(dto.id(), dto.restaurantId(), module,
                dto.name(), dto.description(), dto.sortOrder(), dto.active(), dto.visiblePositionIds());
        return training.createCategory(restaurantId, principal.userId(), fixed);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/categories/{categoryId}")
    public TrainingCategoryDto updateCategory(@PathVariable Long restaurantId,
                                              @PathVariable Long categoryId,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody TrainingCategoryDto dto) {
        return training.updateCategory(restaurantId, principal.userId(), categoryId, dto);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/categories/{categoryId}")
    public void deleteCategory(@PathVariable Long restaurantId,
                               @PathVariable Long categoryId,
                               @AuthenticationPrincipal UserPrincipal principal) {
        training.deleteCategory(restaurantId, principal.userId(), categoryId);
    }

    /* ===== ITEMS ===== */

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/categories/{categoryId}/items")
    public List<TrainingItemDto> listItems(@PathVariable Long restaurantId,
                                           @PathVariable Long categoryId,
                                           @AuthenticationPrincipal UserPrincipal principal) {
        return training.listItems(restaurantId, principal.userId(), categoryId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/items")
    public TrainingItemDto createItem(@PathVariable Long restaurantId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody TrainingItemDto dto) {
        return training.createItem(restaurantId, principal.userId(), dto);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/items/{itemId}")
    public TrainingItemDto updateItem(@PathVariable Long restaurantId,
                                      @PathVariable Long itemId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody TrainingItemDto dto) {
        return training.updateItem(restaurantId, principal.userId(), itemId, dto);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/items/{itemId}")
    public void deleteItem(@PathVariable Long restaurantId,
                           @PathVariable Long itemId,
                           @AuthenticationPrincipal UserPrincipal principal) {
        training.deleteItem(restaurantId, principal.userId(), itemId);
    }
}