package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.CertificationAssignmentCycle;

public interface CertificationAssignmentCycleRepository extends JpaRepository<CertificationAssignmentCycle, Long> {
    @Query("select coalesce(max(c.cycleSequence), 0) from CertificationAssignmentCycle c where c.exam.id = :examId")
    int findMaxCycleSequence(@Param("examId") Long examId);
}
