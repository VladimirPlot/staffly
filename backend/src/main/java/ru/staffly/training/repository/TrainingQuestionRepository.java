package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingQuestion;

import java.util.List;
import java.util.Optional;

public interface TrainingQuestionRepository extends JpaRepository<TrainingQuestion, Long> {
    List<TrainingQuestion> findByRestaurantIdAndFolderIdOrderBySortOrderAscIdAsc(Long restaurantId, Long folderId);
    List<TrainingQuestion> findByRestaurantIdAndFolderIdInAndActiveTrue(Long restaurantId, List<Long> folderIds);
    Optional<TrainingQuestion> findByIdAndRestaurantId(Long id, Long restaurantId);
}
