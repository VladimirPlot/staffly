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
import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

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
    public CertificationMyResultDto getCurrentUserResult(TrainingExam exam,
                                                         Long restaurantId,
                                                         Long userId,
                                                         TrainingExamAssignment normalizedActiveAssignment) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Personal result is available only for certification exams.");
        }

        var assignment = normalizedActiveAssignment != null
                ? normalizedActiveAssignment
                : assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(exam.getId(), restaurantId, userId).orElse(null);
        var fallbackAssignment = assignment == null
                ? assignments.findTopByExamIdAndRestaurantIdAndUserIdOrderByActiveDescAssignedAtDescIdDesc(exam.getId(), restaurantId, userId).orElse(null)
                : null;
        var assignmentForResult = assignment != null ? assignment : fallbackAssignment;

        if (assignmentForResult == null) {
            throw new ConflictException("Для вас нет назначения или истории попыток по этой аттестации.");
        }

        var finishedAttempts = attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(
                assignmentForResult.getId(),
                assignmentForResult.getExamVersionSnapshot()
        );
        var lastFinishedAttempt = finishedAttempts.stream().findFirst();

        Integer attemptsAllowed = certificationAssignmentService.calculateAttemptsAllowed(assignmentForResult);
        boolean passed = lastFinishedAttempt.map(attempt -> Boolean.TRUE.equals(attempt.getPassed())).orElse(false)
                || assignmentForResult.getPassedAt() != null
                || assignmentForResult.getStatus() == TrainingExamAssignmentStatus.PASSED;
        boolean attemptsRemain = attemptsAllowed == null || assignmentForResult.getAttemptsUsed() < attemptsAllowed;
        boolean revealCorrectAnswers = !attemptsRemain || passed;

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
                                    revealCorrectAnswers ? item.getCorrectKeyJson() : null,
                                    snapshot.explanation()
                            );
                        })
                        .toList())
                .orElse(List.of());

        return new CertificationMyResultDto(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                assignmentForResult.getStatus(),
                lastFinishedAttempt.map(attempt -> attempt.getScorePercent()).orElse(null),
                exam.getPassPercent(),
                assignmentForResult.getAttemptsUsed(),
                attemptsAllowed,
                revealCorrectAnswers,
                assignmentForResult.getBestScore(),
                assignmentForResult.getLastAttemptAt(),
                assignmentForResult.getPassedAt(),
                questions
        );
    }
}
