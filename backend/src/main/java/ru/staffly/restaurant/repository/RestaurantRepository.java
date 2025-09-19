package ru.staffly.restaurant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.restaurant.model.Restaurant;

import java.util.Optional;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {
    Optional<Restaurant> findByCode(String code);
}