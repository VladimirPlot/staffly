package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingExamAttemptQuestion;

import java.util.List;

public interface TrainingExamAttemptQuestionRepository extends JpaRepository<TrainingExamAttemptQuestion, Long> {
    List<TrainingExamAttemptQuestion> findByAttemptId(Long attemptId);
    void deleteByAttemptId(Long attemptId);
}
