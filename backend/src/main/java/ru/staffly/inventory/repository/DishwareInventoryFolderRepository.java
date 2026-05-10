package ru.staffly.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.inventory.model.DishwareInventoryFolder;

import java.util.List;
import java.util.Optional;

public interface DishwareInventoryFolderRepository extends JpaRepository<DishwareInventoryFolder, Long> {

    List<DishwareInventoryFolder> findByRestaurantIdOrderBySortOrderAscNameAsc(Long restaurantId);

    Optional<DishwareInventoryFolder> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Query("""
            select folder
            from DishwareInventoryFolder folder
            where folder.restaurant.id = :restaurantId
              and ((:parentId is null and folder.parent is null) or folder.parent.id = :parentId)
            """)
    List<DishwareInventoryFolder> findDirectChildren(@Param("restaurantId") Long restaurantId, @Param("parentId") Long parentId);

    @Query("""
            select coalesce(max(folder.sortOrder), -1)
            from DishwareInventoryFolder folder
            where folder.restaurant.id = :restaurantId
              and ((:parentId is null and folder.parent is null) or folder.parent.id = :parentId)
            """)
    Integer maxSortOrderInParent(@Param("restaurantId") Long restaurantId, @Param("parentId") Long parentId);
}
