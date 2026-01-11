package ru.staffly.common.time;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
public class RestaurantTimeService {

    private final RestaurantRepository restaurants;
    private final Clock clock;

    public Instant nowInstant() {
        return clock.instant();
    }

    public ZoneId zoneFor(Restaurant restaurant) {
        return ZoneId.of(restaurant.getTimezone());
    }

    public ZoneId zoneByRestaurantId(Long restaurantId) {
        return restaurants.findById(restaurantId)
                .map(Restaurant::getTimezone)
                .map(ZoneId::of)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
    }

    public LocalDate today(Restaurant restaurant) {
        return LocalDate.now(clock.withZone(zoneFor(restaurant)));
    }

    public LocalDate today(Long restaurantId) {
        ZoneId zone = zoneByRestaurantId(restaurantId);
        return LocalDate.now(clock.withZone(zone));
    }

    public Instant startOfDay(Restaurant restaurant) {
        return startOfDay(restaurant, today(restaurant));
    }

    public Instant startOfDay(Restaurant restaurant, LocalDate date) {
        return date.atStartOfDay(zoneFor(restaurant)).toInstant();
    }

    public Instant startOfDay(Long restaurantId, LocalDate date) {
        ZoneId zone = zoneByRestaurantId(restaurantId);
        return date.atStartOfDay(zone).toInstant();
    }
}