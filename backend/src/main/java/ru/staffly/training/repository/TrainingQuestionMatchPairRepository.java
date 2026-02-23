package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingQuestionMatchPair;

import java.util.List;

public interface TrainingQuestionMatchPairRepository extends JpaRepository<TrainingQuestionMatchPair, Long> {
    List<TrainingQuestionMatchPair> findByQuestionIdOrderBySortOrderAscIdAsc(Long questionId);
    List<TrainingQuestionMatchPair> findByQuestionIdInOrderBySortOrderAscIdAsc(List<Long> questionIds);
    void deleteByQuestionId(Long questionId);
}
