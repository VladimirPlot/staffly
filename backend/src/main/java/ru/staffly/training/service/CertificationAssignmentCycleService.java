package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.CertificationAssignmentCycleRepository;
import ru.staffly.training.repository.TrainingExamRepository;
import ru.staffly.user.model.User;

@Service
@RequiredArgsConstructor
public class CertificationAssignmentCycleService {
    private final TrainingExamRepository exams;
    private final CertificationAssignmentCycleRepository cycles;

    @Transactional
    public CertificationAssignmentCycle createPublicationCycle(
            TrainingExam exam, CertificationAssessmentSpecification specification, User launchedBy) {
        return create(exam, specification, CertificationAssignmentCycleKind.VERSION_PUBLICATION, launchedBy);
    }

    @Transactional
    public CertificationAssignmentCycle createRecertificationCycle(
            TrainingExam exam, CertificationAssessmentSpecification specification, User launchedBy) {
        return create(exam, specification, CertificationAssignmentCycleKind.RE_CERTIFICATION, launchedBy);
    }

    private CertificationAssignmentCycle create(TrainingExam exam,
                                                CertificationAssessmentSpecification specification,
                                                CertificationAssignmentCycleKind kind,
                                                User launchedBy) {
        if (exam.getId() == null || specification.getId() == null
                || !exam.getId().equals(specification.getExam().getId())) {
            throw new ConflictException("Цикл назначения и спецификация должны принадлежать одной аттестации.");
        }

        // Serialization invariant: lock exam -> allocate max + 1 -> insert cycle.
        var lockedExam = exams.findByIdAndRestaurantIdForUpdate(exam.getId(), exam.getRestaurant().getId())
                .orElseThrow(() -> new ConflictException("Аттестация уже изменена или удалена."));
        int nextSequence = cycles.findMaxCycleSequence(lockedExam.getId()) + 1;
        return cycles.saveAndFlush(CertificationAssignmentCycle.builder()
                .exam(lockedExam)
                .assessmentSpecification(specification)
                .cycleSequence(nextSequence)
                .kind(kind)
                .launchedBy(launchedBy)
                .build());
    }
}
