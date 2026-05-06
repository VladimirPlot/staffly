package ru.staffly.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.inventory.model.InventoryLayout;

import java.util.Optional;

public interface InventoryLayoutRepository extends JpaRepository<InventoryLayout, Long> {
    Optional<InventoryLayout> findByUserIdAndRestaurantId(Long userId, Long restaurantId);
}
