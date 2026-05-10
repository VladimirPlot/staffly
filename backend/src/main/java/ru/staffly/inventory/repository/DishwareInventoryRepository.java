package ru.staffly.inventory.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.inventory.model.DishwareInventory;

import java.util.List;
import java.util.Optional;

public interface DishwareInventoryRepository extends JpaRepository<DishwareInventory, Long> {

    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "folder", "items"})
    List<DishwareInventory> findByRestaurantIdOrderByInventoryDateDescUpdatedAtDesc(Long restaurantId);

    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "folder", "items"})
    List<DishwareInventory> findByRestaurantIdAndTrashedAtIsNullOrderByInventoryDateDescUpdatedAtDesc(Long restaurantId);

    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "folder", "items"})
    Optional<DishwareInventory> findByIdAndRestaurantId(Long inventoryId, Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "folder", "items"})
    Optional<DishwareInventory> findWithLockByIdAndRestaurantId(Long inventoryId, Long restaurantId);

    boolean existsBySourceInventoryId(Long sourceInventoryId);

    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "folder", "items"})
    List<DishwareInventory> findByRestaurantIdAndFolderIdIn(Long restaurantId, List<Long> folderIds);

    @EntityGraph(attributePaths = {"restaurant", "sourceInventory", "folder", "items"})
    @Query("""
            select inventory
            from DishwareInventory inventory
            where inventory.restaurant.id = :restaurantId
              and ((:folderId is null and inventory.folder is null) or inventory.folder.id = :folderId)
            """)
    List<DishwareInventory> findDirectChildren(@Param("restaurantId") Long restaurantId, @Param("folderId") Long folderId);

    @Query("""
            select coalesce(max(inventory.sortOrder), -1)
            from DishwareInventory inventory
            where inventory.restaurant.id = :restaurantId
              and ((:folderId is null and inventory.folder is null) or inventory.folder.id = :folderId)
            """)
    Integer maxSortOrderInFolder(@Param("restaurantId") Long restaurantId, @Param("folderId") Long folderId);
}
