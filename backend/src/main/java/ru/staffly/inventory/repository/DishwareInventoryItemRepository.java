package ru.staffly.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.inventory.model.DishwareInventoryItem;

import java.util.Optional;

public interface DishwareInventoryItemRepository extends JpaRepository<DishwareInventoryItem, Long> {

    @Query("""
           select item
           from DishwareInventoryItem item
           join fetch item.inventory inventory
           join fetch inventory.restaurant restaurant
           left join fetch inventory.sourceInventory sourceInventory
           where item.id = :itemId
             and inventory.id = :inventoryId
             and restaurant.id = :restaurantId
           """)
    Optional<DishwareInventoryItem> findByIdAndInventoryIdAndRestaurantId(Long itemId, Long inventoryId, Long restaurantId);
}
