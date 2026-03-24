package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.repository.TrainingExamRepository;

@Service
@RequiredArgsConstructor
class CertificationManagerActionService {
    private final TrainingExamRepository exams;
    private final CertificationAssignmentService assignments;

    @Transactional
    public void resetAttemptsForEmployee(Long restaurantId, Long examId, Long userId) {
        ensureCertificationExam(restaurantId, examId);
        assignments.fullResetEmployeeAttempts(restaurantId, examId, userId);
    }

    @Transactional
    public void grantExtraAttemptForEmployee(Long restaurantId, Long examId, Long userId, Integer amount) {
        ensureCertificationExam(restaurantId, examId);
        int value = amount == null ? 1 : amount;
        if (value < 1) {
            throw new BadRequestException("Amount must be greater than zero.");
        }
        assignments.reopenByGrantingExtraAttempts(restaurantId, examId, userId, value);
    }

    private void ensureCertificationExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Manager actions are available only for certification exams.");
        }
    }
}