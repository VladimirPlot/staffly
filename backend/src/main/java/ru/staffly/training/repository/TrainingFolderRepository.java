package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.training.model.TrainingFolder;
import ru.staffly.training.model.TrainingFolderType;

import java.util.List;
import java.util.Optional;

public interface TrainingFolderRepository extends JpaRepository<TrainingFolder, Long> {
    List<TrainingFolder> findByRestaurantIdAndTypeOrderBySortOrderAscNameAsc(Long restaurantId, TrainingFolderType type);
    List<TrainingFolder> findByRestaurantIdAndTypeAndActiveTrueOrderBySortOrderAscNameAsc(Long restaurantId, TrainingFolderType type);
    List<TrainingFolder> findByRestaurantIdAndType(Long restaurantId, TrainingFolderType type);
    List<TrainingFolder> findByRestaurantIdAndParentId(Long restaurantId, Long parentId);
    Optional<TrainingFolder> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TrainingFolder f set f.active = :active where f.restaurant.id = :restaurantId and f.id in :ids")
    int updateActiveByRestaurantIdAndIdIn(Long restaurantId, List<Long> ids, boolean active);
}
