package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.CertificationAssessmentSpecification;

import java.util.Optional;

public interface CertificationAssessmentSpecificationRepository
        extends JpaRepository<CertificationAssessmentSpecification, Long> {
    Optional<CertificationAssessmentSpecification> findByExamIdAndVersion(Long examId, int version);
}
