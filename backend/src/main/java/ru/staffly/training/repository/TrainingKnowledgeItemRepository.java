package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.training.model.TrainingKnowledgeItem;

import java.util.List;
import java.util.Optional;

public interface TrainingKnowledgeItemRepository extends JpaRepository<TrainingKnowledgeItem, Long> {
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdOrderBySortOrderAscTitleAsc(Long restaurantId, Long folderId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(Long restaurantId, Long folderId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdIn(Long restaurantId, List<Long> folderIds);
    Optional<TrainingKnowledgeItem> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update TrainingKnowledgeItem i set i.active = :active where i.restaurant.id = :restaurantId and i.folder.id in :folderIds")
    int updateActiveByRestaurantIdAndFolderIdIn(Long restaurantId, List<Long> folderIds, boolean active);
}
