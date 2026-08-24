package ru.staffly.training.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.CertificationAssignmentCycleNotificationState;

import java.util.Optional;

public interface CertificationAssignmentCycleNotificationStateRepository
        extends JpaRepository<CertificationAssignmentCycleNotificationState, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from CertificationAssignmentCycleNotificationState s where s.assignmentCycleId = :cycleId")
    Optional<CertificationAssignmentCycleNotificationState> findByCycleIdForUpdate(@Param("cycleId") Long cycleId);
}
