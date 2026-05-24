package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.training.dto.SubmitAttemptAnswerDto;
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.model.TrainingExamAttemptQuestion;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
class CertificationAttemptFinalizationService {
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final ExamSnapshotService snapshotService;
    private final ExamAttemptEvaluator attemptEvaluator;
    private final CertificationAssignmentService assignmentService;

    // Single source of truth for any certification attempt completion:
    // user submit, expired timeout auto-close, and lifecycle repair all converge here.
    public FinalizedAttemptPayload finalizeUserSubmission(TrainingExamAttempt attempt,
                                                          Map<Long, SubmitAttemptAnswerDto> answersByQuestionId,
                                                          Instant finishedAt) {
        return finalizeInternal(attempt, answersByQuestionId, finishedAt, AttemptFinalizationMode.USER_SUBMIT);
    }

    public void finalizeExpiredUnfinishedAttempt(TrainingExamAttempt attempt, Instant finishedAt) {
        finalizeInternal(attempt, Map.of(), finishedAt, AttemptFinalizationMode.EXPIRED_TIMEOUT);
    }

    public void finalizeStaleUnfinishedAttemptForLifecycleRepair(TrainingExamAttempt attempt, Instant finishedAt) {
        finalizeInternal(attempt, Map.of(), finishedAt, AttemptFinalizationMode.LIFECYCLE_REPAIR);
    }

    private FinalizedAttemptPayload finalizeInternal(TrainingExamAttempt attempt,
                                                     Map<Long, SubmitAttemptAnswerDto> answersByQuestionId,
                                                     Instant finishedAt,
                                                     AttemptFinalizationMode mode) {
        if (attempt.getFinishedAt() != null) {
            return new FinalizedAttemptPayload(attempt, attemptQuestions.findByAttemptId(attempt.getId()));
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
        if (attempt.getExam() != null && attempt.getExam().getMode() == TrainingExamMode.CERTIFICATION) {
            assignmentService.updateOnSubmit(attempt);
        }

        return new FinalizedAttemptPayload(attempt, existingQuestions);
    }

    record FinalizedAttemptPayload(
            TrainingExamAttempt attempt,
            List<TrainingExamAttemptQuestion> questions
    ) {
    }

    private enum AttemptFinalizationMode {
        USER_SUBMIT,
        EXPIRED_TIMEOUT,
        LIFECYCLE_REPAIR
    }
}