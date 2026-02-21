package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingExamScope;

import java.util.List;

public interface TrainingExamScopeRepository extends JpaRepository<TrainingExamScope, Long> {
    List<TrainingExamScope> findByExamId(Long examId);
    void deleteByExamId(Long examId);
}
