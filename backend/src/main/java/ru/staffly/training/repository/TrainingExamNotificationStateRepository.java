package ru.staffly.training.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExamNotificationState;

import java.util.Optional;

public interface TrainingExamNotificationStateRepository extends JpaRepository<TrainingExamNotificationState, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s from TrainingExamNotificationState s
            where s.examId = :examId
            """)
    Optional<TrainingExamNotificationState> findByExamIdForUpdate(@Param("examId") Long examId);
}