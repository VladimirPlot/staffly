package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExamSourceQuestion;
import ru.staffly.training.repository.projection.TrainingExamUsageProjection;

import java.util.List;

public interface TrainingExamSourceQuestionRepository extends JpaRepository<TrainingExamSourceQuestion, Long> {
    List<TrainingExamSourceQuestion> findByExamId(Long examId);

    @Query("select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId " +
            "from TrainingExamSourceQuestion s join s.exam e " +
            "where s.question.id = :questionId and e.restaurant.id = :restaurantId")
    List<TrainingExamUsageProjection> findExamUsagesByRestaurantIdAndQuestionId(@Param("restaurantId") Long restaurantId, @Param("questionId") Long questionId);

    @Query("select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId " +
            "from TrainingExamSourceQuestion s join s.exam e " +
            "where s.question.id = :questionId and e.restaurant.id = :restaurantId and e.active = true")
    List<TrainingExamUsageProjection> findActiveExamUsagesByRestaurantIdAndQuestionId(
            @Param("restaurantId") Long restaurantId,
            @Param("questionId") Long questionId);

    @Query("select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId " +
            "from TrainingExamSourceQuestion s join s.exam e join s.question q " +
            "where q.folder.id in :folderIds and e.restaurant.id = :restaurantId and e.active = true")
    List<TrainingExamUsageProjection> findActiveExamUsagesByRestaurantIdAndQuestionFolderIds(
            @Param("restaurantId") Long restaurantId,
            @Param("folderIds") List<Long> folderIds);

    @Query("select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId " +
            "from TrainingExamSourceQuestion s join s.exam e join s.question q " +
            "where q.folder.id in :folderIds and e.restaurant.id = :restaurantId")
    List<TrainingExamUsageProjection> findExamUsagesByRestaurantIdAndQuestionFolderIds(
            @Param("restaurantId") Long restaurantId,
            @Param("folderIds") List<Long> folderIds);

    void deleteByExamId(Long examId);
}
