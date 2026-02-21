package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingExamAttempt;

import java.util.Optional;

public interface TrainingExamAttemptRepository extends JpaRepository<TrainingExamAttempt, Long> {
    Optional<TrainingExamAttempt> findByIdAndExamRestaurantId(Long id, Long restaurantId);
}
