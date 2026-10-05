package ru.staffly.restaurant.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.restaurant.dto.CreateRestaurantRequest;
import ru.staffly.restaurant.dto.RestaurantDto;
import ru.staffly.restaurant.dto.UpdateRestaurantRequest;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.restaurant.service.RestaurantService;
import ru.staffly.security.UserPrincipal;

@RestController
@RequestMapping("/api/restaurants")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService service;
    private final RestaurantRepository restaurants;

    // только СОЗДАТЕЛЬ
    @PreAuthorize("hasRole('CREATOR')")
    @PostMapping
    public RestaurantDto create(@RequestBody @Valid CreateRestaurantRequest req) {
        // CREATOR has global access; restaurant creation must not create an employee membership.
        return RestaurantDto.from(service.create(req));
    }

    // только СОЗДАТЕЛЬ — назначить существующего пользователя как ADMIN
    public record AssignAdminRequest(@NotNull Long userId, @NotNull Long positionId) {}

    @PreAuthorize("hasRole('CREATOR')")
    @PostMapping("/{restaurantId}/members/assign-admin")
    public void assignAdmin(@PathVariable Long restaurantId, @Valid @RequestBody AssignAdminRequest req) {
        service.assignAdmin(restaurantId, req.userId(), req.positionId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #id)")
    @GetMapping("/{id}")
    public RestaurantDto getById(@PathVariable Long id) {
        var r = restaurants.findById(id)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + id));
        return RestaurantDto.from(r);
    }

    @PreAuthorize("hasRole('CREATOR')")
    @PutMapping("/{id}")
    public RestaurantDto update(@PathVariable Long id, @RequestBody @Valid UpdateRestaurantRequest req) {
        return RestaurantDto.from(service.update(id, req));
    }

    @PreAuthorize("hasRole('CREATOR')")
    @PostMapping("/{id}/lock")
    public RestaurantDto toggleLock(@PathVariable Long id) {
        return RestaurantDto.from(service.toggleLock(id));
    }

    @PreAuthorize("hasRole('CREATOR')")
    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        service.delete(id, principal.userId());
    }
}
