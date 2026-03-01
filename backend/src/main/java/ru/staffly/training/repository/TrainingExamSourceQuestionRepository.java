package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExamSourceQuestion;
import ru.staffly.training.repository.projection.TrainingExamUsageProjection;

import java.util.List;

public interface TrainingExamSourceQuestionRepository extends JpaRepository<TrainingExamSourceQuestion, Long> {
    List<TrainingExamSourceQuestion> findByExamId(Long examId);

    @Query("select distinct e.id as id, e.title as title, e.mode as mode, e.knowledgeFolder.id as knowledgeFolderId " +
            "from TrainingExamSourceQuestion s join s.exam e " +
            "where s.question.id = :questionId and e.restaurant.id = :restaurantId")
    List<TrainingExamUsageProjection> findExamUsagesByRestaurantIdAndQuestionId(@Param("restaurantId") Long restaurantId, @Param("questionId") Long questionId);

    void deleteByExamId(Long examId);
}
