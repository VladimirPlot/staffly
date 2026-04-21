package ru.staffly.inventory.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import ru.staffly.inventory.model.DishwareInventory;

import java.util.List;
import java.util.Optional;

public interface DishwareInventoryRepository extends JpaRepository<DishwareInventory, Long> {

    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "items"})
    List<DishwareInventory> findByRestaurantIdOrderByInventoryDateDescUpdatedAtDesc(Long restaurantId);

    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "items"})
    Optional<DishwareInventory> findByIdAndRestaurantId(Long inventoryId, Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "items"})
    Optional<DishwareInventory> findWithLockByIdAndRestaurantId(Long inventoryId, Long restaurantId);

    boolean existsBySourceInventoryId(Long sourceInventoryId);
}
