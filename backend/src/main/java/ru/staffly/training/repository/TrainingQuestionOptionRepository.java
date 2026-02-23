package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingQuestionOption;

import java.util.List;

public interface TrainingQuestionOptionRepository extends JpaRepository<TrainingQuestionOption, Long> {
    List<TrainingQuestionOption> findByQuestionIdOrderBySortOrderAscIdAsc(Long questionId);
    List<TrainingQuestionOption> findByQuestionIdInOrderBySortOrderAscIdAsc(List<Long> questionIds);
    void deleteByQuestionId(Long questionId);
}
