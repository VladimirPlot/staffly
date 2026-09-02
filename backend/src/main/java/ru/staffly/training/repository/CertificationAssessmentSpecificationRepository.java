package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.CertificationAssessmentSpecification;

import java.util.Optional;

public interface CertificationAssessmentSpecificationRepository
        extends JpaRepository<CertificationAssessmentSpecification, Long> {
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from certification_assessment_specification where exam_id = :examId", nativeQuery = true)
    int deleteAllForExam(@Param("examId") Long examId);

    Optional<CertificationAssessmentSpecification> findByExamIdAndVersion(Long examId, int version);
}
