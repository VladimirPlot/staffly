package ru.staffly.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.inventory.model.DishwareInventoryFolder;

import java.util.List;
import java.util.Optional;

public interface DishwareInventoryFolderRepository extends JpaRepository<DishwareInventoryFolder, Long> {

    List<DishwareInventoryFolder> findByRestaurantIdOrderBySortOrderAscNameAsc(Long restaurantId);

    Optional<DishwareInventoryFolder> findByIdAndRestaurantId(Long id, Long restaurantId);
}
