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
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.util.List;
import java.util.Optional;

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
                : assignments.findCurrentActiveByExamAndUser(exam.getId(), restaurantId, userId).orElse(null);
        var validResult = assignments
                .findTopByExamIdAndRestaurantIdAndUserIdAndPassedAtIsNotNullOrderByPassedAtDescIdDesc(
                        exam.getId(), restaurantId, userId)
                .orElse(null);
        var unfinishedCandidates = attempts
                .findByExamIdAndRestaurantIdAndUserIdAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
                        exam.getId(), restaurantId, userId);
        if (unfinishedCandidates.size() > 1) {
            throw new ConflictException("Нарушена целостность: найдено несколько незавершённых попыток аттестации.");
        }
        var unfinished = unfinishedCandidates.stream().findFirst().orElse(null);
        var assignmentForResult = validResult != null ? validResult
                : assignment != null ? assignment
                : unfinished == null ? null : unfinished.getAssignment();

        if (assignmentForResult == null) {
            throw new ConflictException("Для вас нет назначения или истории попыток по этой аттестации.");
        }

        var finishedAttempts = attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(
                assignmentForResult.getId(),
                assignmentForResult.getExamVersionSnapshot()
        );
        var lastFinishedAttempt = finishedAttempts.stream().findFirst();
        var passedAttempt = attempts.findTopByAssignmentIdAndExamVersionAndPassedTrueAndFinishedAtIsNotNullOrderByFinishedAtAscIdAsc(
                assignmentForResult.getId(),
                assignmentForResult.getExamVersionSnapshot()
        );
        var attemptForDetails = resolveAttemptForDetails(assignmentForResult, passedAttempt, lastFinishedAttempt);

        var obligationForAllowance = assignment != null ? assignment : assignmentForResult;
        Integer attemptsAllowed = certificationAssignmentService.calculateAttemptsAllowed(obligationForAllowance);
        boolean passed = attemptForDetails.map(attempt -> Boolean.TRUE.equals(attempt.getPassed())).orElse(false)
                || assignmentForResult.getPassedAt() != null
                || assignmentForResult.getStatus() == TrainingExamAssignmentStatus.PASSED;
        boolean revealCorrectAnswers = certificationAssignmentService.shouldRevealCorrectAnswers(assignmentForResult, passed);

        var questions = attemptForDetails
                .map(attempt -> attemptQuestions.findByAttemptId(attempt.getId()).stream()
                        .map(item -> {
                            var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());
                            return new CertificationMyResultQuestionDto(
                                    snapshot.questionId(),
                                    snapshot.type(),
                                    snapshot.prompt(),
                                    item.getChosenAnswerJson(),
                                    revealCorrectAnswers ? item.isCorrect() : null,
                                    revealCorrectAnswers ? item.getCorrectKeyJson() : null,
                                    revealCorrectAnswers ? snapshot.explanation() : null
                            );
                        })
                        .toList())
                .orElse(List.of());

        var currentCycle = assignment == null ? null : assignment.getAssignmentCycle();
        var validCycle = validResult == null ? null : validResult.getAssignmentCycle();
        boolean hasPendingNewerObligation = unfinished != null && assignment != null
                && (unfinished.getAssignment() == null
                || !assignment.getId().equals(unfinished.getAssignment().getId()));
        return new CertificationMyResultDto(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getVersion(),
                validResult != null,
                assignment == null ? null : assignment.getId(),
                assignment == null ? null : assignment.getExamVersionSnapshot(),
                currentCycle == null ? null : currentCycle.getId(),
                currentCycle == null ? null : currentCycle.getCycleSequence(),
                currentCycle == null ? null : currentCycle.getKind(),
                assignment == null ? null : assignment.getResetGeneration(),
                assignment == null ? null : assignment.getStatus(),
                assignment == null ? null : assignment.getDeactivationReason(),
                validResult == null ? null : validResult.getId(),
                validResult == null ? null : validResult.getExamVersionSnapshot(),
                validCycle == null ? null : validCycle.getId(),
                validResult == null ? null : validResult.getPassedAt(),
                validResult == null ? null : validResult.getBestScore(),
                validResult == null ? null : validResult.getDeactivationReason(),
                unfinished == null ? null : unfinished.getId(),
                unfinished == null ? null : unfinished.getExamVersion(),
                unfinished == null || unfinished.getAssignment() == null ? null : unfinished.getAssignment().getId(),
                hasPendingNewerObligation,
                attemptForDetails.map(attempt -> attempt.getScorePercent()).orElse(null),
                assignmentForResult.getAssessmentSpecification().getPassPercent(),
                obligationForAllowance.getAttemptsUsed(),
                attemptsAllowed,
                revealCorrectAnswers,
                assignmentForResult.getBestScore(),
                attemptForDetails.map(TrainingExamAttempt::getStartedAt).orElse(null),
                attemptForDetails.map(TrainingExamAttempt::getFinishedAt).orElse(null),
                assignmentForResult.getLastAttemptAt(),
                assignmentForResult.getPassedAt(),
                questions
        );
    }

    private Optional<TrainingExamAttempt> resolveAttemptForDetails(
            TrainingExamAssignment assignment,
            Optional<TrainingExamAttempt> passedAttempt,
            Optional<TrainingExamAttempt> lastFinishedAttempt
    ) {
        if (assignment.getPassedAt() != null || assignment.getStatus() == TrainingExamAssignmentStatus.PASSED) {
            return passedAttempt.or(() -> lastFinishedAttempt);
        }
        return lastFinishedAttempt;
    }
}
