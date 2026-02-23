package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingKnowledgeItem;

import java.util.List;
import java.util.Optional;

public interface TrainingKnowledgeItemRepository extends JpaRepository<TrainingKnowledgeItem, Long> {
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdOrderBySortOrderAscTitleAsc(Long restaurantId, Long folderId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(Long restaurantId, Long folderId);
    List<TrainingKnowledgeItem> findByRestaurantIdAndFolderIdIn(Long restaurantId, List<Long> folderIds);
    Optional<TrainingKnowledgeItem> findByIdAndRestaurantId(Long id, Long restaurantId);
}
