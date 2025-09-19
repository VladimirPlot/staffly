package ru.staffly.restaurant.service;

import ru.staffly.restaurant.dto.CreateRestaurantRequest;
import ru.staffly.restaurant.model.Restaurant;

public interface RestaurantService {
    Restaurant create(CreateRestaurantRequest req);
    void assignAdmin(Long restaurantId, Long userId);
}