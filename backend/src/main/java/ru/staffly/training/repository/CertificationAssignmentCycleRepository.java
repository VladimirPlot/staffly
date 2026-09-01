package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.CertificationAssignmentCycle;
import ru.staffly.training.model.CertificationAssignmentCycleKind;

import java.util.Optional;

public interface CertificationAssignmentCycleRepository extends JpaRepository<CertificationAssignmentCycle, Long> {
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from certification_assignment_cycle where exam_id = :examId", nativeQuery = true)
    int deleteAllForExam(@Param("examId") Long examId);

    @Query("select coalesce(max(c.cycleSequence), 0) from CertificationAssignmentCycle c where c.exam.id = :examId")
    int findMaxCycleSequence(@Param("examId") Long examId);

    Optional<CertificationAssignmentCycle> findTopByExamIdAndAssessmentSpecificationIdAndKindOrderByCycleSequenceDesc(
            Long examId, Long specificationId, CertificationAssignmentCycleKind kind);

    Optional<CertificationAssignmentCycle> findTopByExamIdAndAssessmentSpecificationIdOrderByCycleSequenceDesc(
            Long examId, Long specificationId);

    Optional<CertificationAssignmentCycle> findTopByExamIdAndCycleSequenceLessThanOrderByCycleSequenceDesc(
            Long examId, int cycleSequence);

    boolean existsByExamIdAndCycleSequenceGreaterThan(Long examId, int cycleSequence);
}
