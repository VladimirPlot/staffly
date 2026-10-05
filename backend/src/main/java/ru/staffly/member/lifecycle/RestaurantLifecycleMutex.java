package ru.staffly.member.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.restaurant.repository.RestaurantRepository;

/** Serializes authority-changing operations for one restaurant. */
@Component
@RequiredArgsConstructor
public class RestaurantLifecycleMutex {
    private final RestaurantRepository restaurants;

    public void lock(Long restaurantId) {
        restaurants.findLifecycleMutex(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
    }
}
