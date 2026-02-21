package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingExam;

import java.util.List;
import java.util.Optional;

public interface TrainingExamRepository extends JpaRepository<TrainingExam, Long> {
    List<TrainingExam> findByRestaurantIdOrderByCreatedAtDesc(Long restaurantId);
    Optional<TrainingExam> findByIdAndRestaurantId(Long id, Long restaurantId);
}
