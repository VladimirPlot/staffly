package ru.staffly.dictionary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.dictionary.model.Position;

import java.util.List;

public interface PositionRepository extends JpaRepository<Position, Long> {

    List<Position> findByRestaurantIdAndActiveTrue(Long restaurantId);

    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);
}