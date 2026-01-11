package ru.staffly.restaurant.controller;

import jakarta.validation.Valid;
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
    public RestaurantDto create(@AuthenticationPrincipal UserPrincipal principal,
                                @RequestBody @Valid CreateRestaurantRequest req) {
        // 1) создаём ресторан (код либо из req, либо сгенерируем уникальный)
        Restaurant saved = service.create(req);
        // 2) сразу делаем текущего пользователя (CREATOR) админом этого ресторана
        service.assignAdmin(saved.getId(), principal.userId());
        // 3) возвращаем созданный ресторан
        return RestaurantDto.from(saved);
    }

    // только СОЗДАТЕЛЬ — назначить существующего пользователя как ADMIN
    public record AssignAdminRequest(Long userId) {}

    @PreAuthorize("hasRole('CREATOR')")
    @PostMapping("/{restaurantId}/members/assign-admin")
    public void assignAdmin(@PathVariable Long restaurantId, @RequestBody AssignAdminRequest req) {
        service.assignAdmin(restaurantId, req.userId());
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