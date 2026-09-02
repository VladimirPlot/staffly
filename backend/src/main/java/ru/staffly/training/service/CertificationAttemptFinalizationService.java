package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.training.dto.SubmitAttemptAnswerDto;
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.model.TrainingExamAttemptQuestion;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.model.TrainingExamAttemptCancellationReason;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
class CertificationAttemptFinalizationService {
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final TrainingExamAttemptRepository attempts;
    private final TrainingExamAssignmentRepository assignments;
    private final EntityManager entityManager;
    private final ExamSnapshotService snapshotService;
    private final ExamAttemptEvaluator attemptEvaluator;
    private final CertificationAssignmentService assignmentService;
    private final RestaurantMemberRepository members;

    // Single source of truth for any certification attempt completion:
    // user submit, expired timeout auto-close, and lifecycle repair all converge here.
    @Transactional
    public FinalizedAttemptPayload finalizeUserSubmission(TrainingExamAttempt attempt,
                                                          Map<Long, SubmitAttemptAnswerDto> answersByQuestionId,
                                                          Instant finishedAt) {
        if (attempt.getExam() == null || attempt.getExam().getMode() != TrainingExamMode.CERTIFICATION) {
            return finalizeMutation(attempt, answersByQuestionId, finishedAt, AttemptFinalizationMode.USER_SUBMIT);
        }
        boolean expired = attempt.getTimeLimitSecSnapshot() != null
                && attempt.getStartedAt().plusSeconds(attempt.getTimeLimitSecSnapshot()).compareTo(finishedAt) <= 0;
        return finalizeCertification(attempt, expired ? Map.of() : answersByQuestionId, finishedAt,
                expired ? AttemptFinalizationMode.EXPIRED_TIMEOUT : AttemptFinalizationMode.USER_SUBMIT);
    }

    @Transactional
    public void finalizeExpiredUnfinishedAttempt(TrainingExamAttempt attempt, Instant finishedAt) {
        finalizeCertification(attempt, Map.of(), finishedAt, AttemptFinalizationMode.EXPIRED_TIMEOUT);
    }

    @Transactional
    public void finalizeStaleUnfinishedAttemptForLifecycleRepair(TrainingExamAttempt attempt, Instant finishedAt) {
        finalizeCertification(attempt, Map.of(), finishedAt, AttemptFinalizationMode.LIFECYCLE_REPAIR);
    }

    private FinalizedAttemptPayload finalizeCertification(TrainingExamAttempt candidate,
                                                           Map<Long, SubmitAttemptAnswerDto> answersByQuestionId,
                                                           Instant finishedAt,
                                                           AttemptFinalizationMode mode) {
        if (candidate.getAssignment() == null) {
            throw new ConflictException("Certification attempt is not linked to an assignment");
        }

        Long restaurantId = candidate.getRestaurant().getId();
        Long assignmentId = candidate.getAssignment().getId();

        // Authoritative lock/refresh order for every Certification finalization is:
        // assignment query lock -> assignment refresh(PESSIMISTIC_WRITE) ->
        // attempt query lock -> attempt refresh(PESSIMISTIC_WRITE).
        // Explicit refresh is required because either entity may already be stale in this
        // transaction's first-level persistence context. Start also locks assignment first,
        // so this sequence does not introduce an inverse lock edge.
        var assignment = assignments.findByIdAndRestaurantIdForFinalizationUpdate(assignmentId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Assignment not found"));
        entityManager.refresh(assignment, LockModeType.PESSIMISTIC_WRITE);
        var attempt = attempts.findByIdAndRestaurantIdForFinalizationUpdate(candidate.getId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Attempt not found"));
        entityManager.refresh(attempt, LockModeType.PESSIMISTIC_WRITE);

        if (attempt.getAssignment() == null
                || !assignmentId.equals(attempt.getAssignment().getId())
                || !assignment.getId().equals(attempt.getAssignment().getId())) {
            throw new ConflictException("Certification attempt assignment is inconsistent");
        }
        if (attempt.getExam() == null || attempt.getExam().getMode() != TrainingExamMode.CERTIFICATION) {
            throw new ConflictException("Attempt is not a Certification attempt");
        }
        if (attempt.getExamVersion() != assignment.getExamVersionSnapshot()) {
            throw new ConflictException("Certification attempt version does not match its assignment");
        }
        if (attempt.getFinishedAt() != null) {
            return new FinalizedAttemptPayload(attempt, attemptQuestions.findByAttemptId(attempt.getId()), false);
        }

        if (mode == AttemptFinalizationMode.EXPIRED_TIMEOUT && positionChangedSinceStart(attempt)) {
            attempt.setFinishedAt(finishedAt);
            attempt.setScorePercent(null);
            attempt.setPassed(null);
            attempt.setCancellationReason(TrainingExamAttemptCancellationReason.POSITION_CHANGED_TIMEOUT);
            assignmentService.reconcileDerivedStateFromFinishedAttempts(assignment);
            assignmentService.refreshStatus(assignment, false);
            return new FinalizedAttemptPayload(attempt, attemptQuestions.findByAttemptId(attempt.getId()), true);
        }

        var result = finalizeMutation(attempt, answersByQuestionId, finishedAt, mode);
        assignmentService.reconcileDerivedStateFromFinishedAttempts(assignment);
        assignmentService.refreshStatus(assignment, attempts.existsByAssignmentIdAndFinishedAtIsNull(assignment.getId()));
        return result;
    }

    private boolean positionChangedSinceStart(TrainingExamAttempt attempt) {
        if (!attempt.isPositionAtStartCaptured()) {
            return false;
        }
        Long currentPositionId = members.findByUserIdAndRestaurantIdWithPosition(
                        attempt.getUser().getId(), attempt.getRestaurant().getId())
                .map(member -> member.getPosition() == null ? null : member.getPosition().getId())
                .orElse(null);
        return !java.util.Objects.equals(attempt.getPositionAtStartId(), currentPositionId);
    }

    private FinalizedAttemptPayload finalizeMutation(TrainingExamAttempt attempt,
                                                      Map<Long, SubmitAttemptAnswerDto> answersByQuestionId,
                                                      Instant finishedAt,
                                                      AttemptFinalizationMode mode) {
        if (attempt.getFinishedAt() != null) {
            return new FinalizedAttemptPayload(attempt, attemptQuestions.findByAttemptId(attempt.getId()), false);
        }

        var existingQuestions = attemptQuestions.findByAttemptId(attempt.getId());
        int correctAnswers = 0;

        for (var item : existingQuestions) {
            var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());

            if (mode == AttemptFinalizationMode.USER_SUBMIT) {
                var answer = answersByQuestionId.get(snapshot.questionId());
                if (answer != null) {
                    if (answer.answerJson() == null || answer.answerJson().isBlank()) {
                        item.setChosenAnswerJson(null);
                        item.setCorrect(false);
                        continue;
                    }

                    attemptEvaluator.validateAnswerForType(answer.answerJson(), snapshot);
                    item.setChosenAnswerJson(answer.answerJson());
                }
            }

            if (item.getChosenAnswerJson() == null || item.getChosenAnswerJson().isBlank()) {
                item.setChosenAnswerJson(null);
                item.setCorrect(false);
                continue;
            }

            boolean correct = attemptEvaluator.isAnswerCorrect(item.getChosenAnswerJson(), item.getCorrectKeyJson(), snapshot.type());
            item.setCorrect(correct);
            if (correct) {
                correctAnswers++;
            }
        }

        int scorePercent = existingQuestions.isEmpty()
                ? 0
                : (int) Math.round((correctAnswers * 100.0) / existingQuestions.size());

        attempt.setFinishedAt(finishedAt);
        attempt.setScorePercent(scorePercent);
        attempt.setPassed(scorePercent >= attempt.getPassPercentSnapshot());
        return new FinalizedAttemptPayload(attempt, existingQuestions, true);
    }

    record FinalizedAttemptPayload(
            TrainingExamAttempt attempt,
            List<TrainingExamAttemptQuestion> questions,
            boolean newlyFinalized
    ) {
    }

    private enum AttemptFinalizationMode {
        USER_SUBMIT,
        EXPIRED_TIMEOUT,
        LIFECYCLE_REPAIR
    }
}
