package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;

import java.util.Optional;

@Service
@RequiredArgsConstructor
class CertificationAssignmentService {
    private final TrainingExamAssignmentRepository assignments;

    @Transactional(readOnly = true)
    public TrainingExamAssignment resolveForStart(TrainingExam exam, Long restaurantId, Long userId) {
        return assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(exam.getId(), restaurantId, userId)
                .orElseThrow(() -> new ConflictException("Для вас нет активного назначения на эту аттестацию."));
    }

    @Transactional(readOnly = true)
    public Optional<TrainingExamAssignment> findActiveForExamAndUser(Long examId, Long restaurantId, Long userId) {
        return assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(examId, restaurantId, userId);
    }

    public void ensureAttemptsAvailable(TrainingExamAssignment assignment) {
        if (assignment.getStatus() == TrainingExamAssignmentStatus.PASSED || assignment.getPassedAt() != null) {
            throw new ConflictException("Аттестация уже успешно пройдена. Повторная попытка недоступна.");
        }
        Integer allowed = calculateAttemptsAllowed(assignment);
        if (allowed != null && assignment.getAttemptsUsed() >= allowed) {
            throw new ConflictException("Лимит попыток по назначенной аттестации исчерпан.");
        }
    }

    public void markStarted(TrainingExamAssignment assignment) {
        if (assignment.getStatus() == TrainingExamAssignmentStatus.PASSED) {
            return;
        }
        assignment.setStatus(TrainingExamAssignmentStatus.IN_PROGRESS);
    }

    public void updateOnSubmit(TrainingExamAttempt attempt) {
        var assignment = attempt.getAssignment();
        if (assignment == null) {
            return;
        }

        assignment.setAttemptsUsed(assignment.getAttemptsUsed() + 1);
        assignment.setLastAttemptAt(attempt.getFinishedAt());

        if (attempt.getScorePercent() != null && (assignment.getBestScore() == null || attempt.getScorePercent() > assignment.getBestScore())) {
            assignment.setBestScore(attempt.getScorePercent());
        }

        if (Boolean.TRUE.equals(attempt.getPassed())) {
            if (assignment.getPassedAt() == null) {
                assignment.setPassedAt(attempt.getFinishedAt());
            }
            assignment.setStatus(TrainingExamAssignmentStatus.PASSED);
            return;
        }

        Integer allowed = calculateAttemptsAllowed(assignment);
        if (allowed != null && assignment.getAttemptsUsed() >= allowed) {
            assignment.setStatus(TrainingExamAssignmentStatus.EXHAUSTED);
        } else {
            assignment.setStatus(TrainingExamAssignmentStatus.FAILED);
        }
    }

    @Transactional
    public void fullResetEmployeeAttempts(Long restaurantId, Long examId, Long userId) {
        var assignment = assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(examId, restaurantId, userId)
                .orElseThrow(() -> new NotFoundException("Assignment not found"));
        assignment.setExamVersionSnapshot(assignment.getExam().getVersion());
        assignment.setAttemptsUsed(0);
        assignment.setExtraAttempts(0);
        assignment.setBestScore(null);
        assignment.setLastAttemptAt(null);
        assignment.setPassedAt(null);
        assignment.setStatus(TrainingExamAssignmentStatus.ASSIGNED);
    }

    @Transactional
    public void reopenByGrantingExtraAttempts(Long restaurantId, Long examId, Long userId, int amount) {
        var assignment = assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(examId, restaurantId, userId)
                .orElseThrow(() -> new NotFoundException("Assignment not found"));
        assignment.setExtraAttempts(assignment.getExtraAttempts() + amount);
        if (assignment.getStatus() == TrainingExamAssignmentStatus.PASSED
                || assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED
                || assignment.getStatus() == TrainingExamAssignmentStatus.IN_PROGRESS) {
            return;
        }
        Integer allowed = calculateAttemptsAllowed(assignment);
        if (allowed == null || assignment.getAttemptsUsed() < allowed) {
            assignment.setStatus(TrainingExamAssignmentStatus.ASSIGNED);
        }
    }

    public Integer calculateAttemptsAllowed(TrainingExamAssignment assignment) {
        if (assignment.getAttemptsLimitSnapshot() == null) {
            return null;
        }
        return assignment.getAttemptsLimitSnapshot() + assignment.getExtraAttempts();
    }
}
