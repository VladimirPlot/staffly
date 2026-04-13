package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.training.dto.CertificationMyResultDto;
import ru.staffly.training.dto.CertificationMyResultQuestionDto;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.model.TrainingExamAssignment;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
class CertificationSelfResultService {
    private final TrainingExamAssignmentRepository assignments;
    private final TrainingExamAttemptRepository attempts;
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final CertificationAssignmentService certificationAssignmentService;
    private final ExamSnapshotService snapshotService;

    @Transactional(readOnly = true)
    public CertificationMyResultDto getCurrentUserResult(TrainingExam exam, Long restaurantId, Long userId) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Personal result is available only for certification exams.");
        }

        var assignment = assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(exam.getId(), restaurantId, userId)
                .orElseThrow(() -> new ConflictException("Для вас нет активного назначения на эту аттестацию."));

        var lastFinishedAttempt = attempts.findByExamIdAndRestaurantIdAndUserIdOrderByStartedAtDesc(exam.getId(), restaurantId, userId)
                .stream()
                .filter(attempt -> attempt.getFinishedAt() != null)
                .filter(attempt -> attempt.getAssignment() != null && assignment.getId().equals(attempt.getAssignment().getId()))
                .max(Comparator.comparing(attempt -> attempt.getFinishedAt()));

        var questions = lastFinishedAttempt
                .map(attempt -> attemptQuestions.findByAttemptId(attempt.getId()).stream()
                        .map(item -> {
                            var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());
                            return new CertificationMyResultQuestionDto(
                                    snapshot.questionId(),
                                    snapshot.type(),
                                    snapshot.prompt(),
                                    item.getChosenAnswerJson(),
                                    item.isCorrect(),
                                    snapshot.explanation()
                            );
                        })
                        .toList())
                .orElse(List.of());

        return new CertificationMyResultDto(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                assignment.getStatus(),
                lastFinishedAttempt.map(attempt -> attempt.getScorePercent()).orElse(null),
                exam.getPassPercent(),
                assignment.getAttemptsUsed(),
                certificationAssignmentService.calculateAttemptsAllowed(assignment),
                assignment.getBestScore(),
                assignment.getLastAttemptAt(),
                assignment.getPassedAt(),
                questions
        );
    }
}