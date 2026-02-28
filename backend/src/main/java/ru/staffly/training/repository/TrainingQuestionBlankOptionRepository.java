package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingQuestionBlankOption;

import java.util.List;

public interface TrainingQuestionBlankOptionRepository extends JpaRepository<TrainingQuestionBlankOption, Long> {
    List<TrainingQuestionBlankOption> findByBlankIdInOrderBySortOrderAscIdAsc(List<Long> blankIds);
    List<TrainingQuestionBlankOption> findByBlankIdOrderBySortOrderAscIdAsc(Long blankId);
    void deleteByBlankIdIn(List<Long> blankIds);
}