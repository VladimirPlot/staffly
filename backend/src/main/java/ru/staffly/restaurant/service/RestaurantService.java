package ru.staffly.restaurant.service;

import ru.staffly.restaurant.dto.CreateRestaurantRequest;
import ru.staffly.restaurant.dto.UpdateRestaurantRequest;
import ru.staffly.restaurant.model.Restaurant;

public interface RestaurantService {
    Restaurant create(CreateRestaurantRequest req);
    Restaurant update(Long restaurantId, UpdateRestaurantRequest req);
    Restaurant toggleLock(Long restaurantId);
    void delete(Long restaurantId, Long creatorUserId);
    void assignAdmin(Long restaurantId, Long userId);
}