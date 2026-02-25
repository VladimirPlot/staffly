package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingKnowledgeItem;

import java.util.List;
import java.util.Optional;

public interface TrainingKnowledgeItemRepository extends JpaRepository<TrainingKnowledgeItem, Long> {
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdOrderBySortOrderAscTitleAsc(Long restaurantId, Long folderId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(Long restaurantId, Long folderId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIsNullOrderBySortOrderAscTitleAsc(Long restaurantId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIsNullAndActiveTrueOrderBySortOrderAscTitleAsc(Long restaurantId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdIn(Long restaurantId, List<Long> folderIds);
    Optional<TrainingKnowledgeItem> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Modifying(flushAutomatically = true)
    @Query("update TrainingKnowledgeItem i set i.active = :active where i.restaurant.id = :restaurantId and i.folder.id in :folderIds")
    int updateActiveByRestaurantIdAndFolderIdIn(@Param("restaurantId") Long restaurantId, @Param("folderIds") List<Long> folderIds, @Param("active") boolean active);
}
