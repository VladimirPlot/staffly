package ru.staffly.restaurant.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import ru.staffly.restaurant.dto.CreateRestaurantRequest;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.service.RestaurantService;

@RestController
@RequestMapping("/api/restaurants")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService service;

    // только СОЗДАТЕЛЬ
    @PreAuthorize("hasRole('CREATOR')")
    @PostMapping
    public Restaurant create(@RequestBody @Valid CreateRestaurantRequest req) {
        return service.create(req);
    }

    // только СОЗДАТЕЛЬ — назначить существующего пользователя как ADMIN
    public record AssignAdminRequest(Long userId) {}

    @PreAuthorize("hasRole('CREATOR')")
    @PostMapping("/{restaurantId}/members/assign-admin")
    public void assignAdmin(@PathVariable Long restaurantId, @RequestBody AssignAdminRequest req) {
        service.assignAdmin(restaurantId, req.userId());
    }
}