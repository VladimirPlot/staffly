package ru.staffly.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.inventory.model.DishwareInventoryHistory;
import java.util.List;

public interface DishwareInventoryHistoryRepository extends JpaRepository<DishwareInventoryHistory, Long> {
    List<DishwareInventoryHistory> findByRestaurantIdAndInventoryIdAndIdLessThanOrderByIdDesc(Long restaurantId, Long inventoryId, Long beforeId, org.springframework.data.domain.Pageable page);
}
