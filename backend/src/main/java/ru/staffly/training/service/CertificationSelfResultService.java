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
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.model.TrainingExamAssignmentStatus;
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

        var current = normalizedActiveAssignment != null
                ? normalizedActiveAssignment
                : assignments.findCurrentActiveByExamAndUser(exam.getId(), restaurantId, userId).orElse(null);
        var passedAssignments = assignments
                .findByExamIdAndRestaurantIdAndUserIdAndPassedAtIsNotNullOrderByPassedAtDescIdDesc(
                        exam.getId(), restaurantId, userId);
        var previousValid = passedAssignments.stream()
                .filter(candidate -> current == null || !candidate.getId().equals(current.getId()))
                .findFirst()
                .orElse(null);
        var unfinishedCandidates = attempts
                .findByExamIdAndRestaurantIdAndUserIdAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
                        exam.getId(), restaurantId, userId);
        if (unfinishedCandidates.size() > 1) {
            throw new ConflictException("Нарушена целостность: найдено несколько незавершённых попыток аттестации.");
        }
        var unfinished = unfinishedCandidates.stream().findFirst().orElse(null);
        if (current == null && previousValid == null && unfinished == null) {
            throw new ConflictException("Для вас нет назначения или истории попыток по этой аттестации.");
        }

        boolean hasPendingNewerObligation = unfinished != null && current != null
                && (unfinished.getAssignment() == null
                || !current.getId().equals(unfinished.getAssignment().getId()));
        return new CertificationMyResultDto(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getVersion(),
                current == null ? null : toCurrentObligation(current),
                previousValid == null ? null : toPreviousValidResult(previousValid),
                unfinished == null ? null : unfinished.getId(),
                unfinished == null ? null : unfinished.getExamVersion(),
                unfinished == null || unfinished.getAssignment() == null ? null : unfinished.getAssignment().getId(),
                hasPendingNewerObligation
        );
    }

    private CertificationMyResultDto.CurrentObligation toCurrentObligation(TrainingExamAssignment assignment) {
        var details = resultDetails(assignment);
        var cycle = assignment.getAssignmentCycle();
        return new CertificationMyResultDto.CurrentObligation(
                assignment.getId(),
                assignment.getAssessmentSpecification().getId(),
                assignment.getExamVersionSnapshot(),
                cycle == null ? null : cycle.getId(),
                cycle == null ? null : cycle.getCycleSequence(),
                cycle == null ? null : cycle.getKind(),
                assignment.getResetGeneration(),
                assignment.getStatus(),
                assignment.getDeactivationReason(),
                assignment.getAttemptsUsed(),
                certificationAssignmentService.calculateAttemptsAllowed(assignment),
                assignment.getBestScore(),
                details.scorePercent(),
                assignment.getAssessmentSpecification().getPassPercent(),
                details.startedAt(),
                details.finishedAt(),
                assignment.getLastAttemptAt(),
                assignment.getPassedAt(),
                details.revealCorrectAnswers(),
                details.questions()
        );
    }

    private CertificationMyResultDto.PreviousValidResult toPreviousValidResult(TrainingExamAssignment assignment) {
        var details = resultDetails(assignment);
        var cycle = assignment.getAssignmentCycle();
        return new CertificationMyResultDto.PreviousValidResult(
                assignment.getId(),
                assignment.getAssessmentSpecification().getId(),
                assignment.getExamVersionSnapshot(),
                cycle == null ? null : cycle.getId(),
                cycle == null ? null : cycle.getCycleSequence(),
                cycle == null ? null : cycle.getKind(),
                assignment.getResetGeneration(),
                assignment.getDeactivationReason(),
                assignment.getBestScore(),
                details.scorePercent(),
                assignment.getAssessmentSpecification().getPassPercent(),
                assignment.getPassedAt(),
                details.startedAt(),
                details.finishedAt(),
                details.revealCorrectAnswers(),
                details.questions()
        );
    }

    private ResultDetails resultDetails(TrainingExamAssignment assignment) {
        var finishedAttempts = attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(
                assignment.getId(), assignment.getExamVersionSnapshot());
        var lastFinishedAttempt = finishedAttempts.stream().findFirst();
        var passedAttempt = attempts.findTopByAssignmentIdAndExamVersionAndPassedTrueAndFinishedAtIsNotNullOrderByFinishedAtAscIdAsc(
                assignment.getId(), assignment.getExamVersionSnapshot());
        var attemptForDetails = resolveAttemptForDetails(assignment, passedAttempt, lastFinishedAttempt);
        boolean passed = attemptForDetails.map(attempt -> Boolean.TRUE.equals(attempt.getPassed())).orElse(false)
                || assignment.getPassedAt() != null
                || assignment.getStatus() == TrainingExamAssignmentStatus.PASSED;
        boolean revealCorrectAnswers = certificationAssignmentService.shouldRevealCorrectAnswers(assignment, passed);
        var questions = revealCorrectAnswers ? attemptForDetails
                .map(attempt -> attemptQuestions.findByAttemptId(attempt.getId()).stream()
                        .map(item -> {
                            var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());
                            return new CertificationMyResultQuestionDto(
                                    snapshot.questionId(), snapshot.type(), snapshot.prompt(), item.getChosenAnswerJson(),
                                    item.isCorrect(), item.getCorrectKeyJson(), snapshot.explanation());
                        })
                        .toList())
                .orElse(List.of()) : List.<CertificationMyResultQuestionDto>of();
        return new ResultDetails(
                attemptForDetails.map(TrainingExamAttempt::getScorePercent).orElse(null),
                attemptForDetails.map(TrainingExamAttempt::getStartedAt).orElse(null),
                attemptForDetails.map(TrainingExamAttempt::getFinishedAt).orElse(null),
                revealCorrectAnswers,
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

    private record ResultDetails(
            Integer scorePercent,
            java.time.Instant startedAt,
            java.time.Instant finishedAt,
            boolean revealCorrectAnswers,
            List<CertificationMyResultQuestionDto> questions
    ) {
    }
}
