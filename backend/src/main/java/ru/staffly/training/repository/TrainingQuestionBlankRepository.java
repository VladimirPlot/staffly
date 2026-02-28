package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingQuestionBlank;

import java.util.List;

public interface TrainingQuestionBlankRepository extends JpaRepository<TrainingQuestionBlank, Long> {
    List<TrainingQuestionBlank> findByQuestionIdInOrderBySortOrderAscIdAsc(List<Long> questionIds);
    List<TrainingQuestionBlank> findByQuestionIdOrderBySortOrderAscIdAsc(Long questionId);
    void deleteByQuestionId(Long questionId);
}