package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.training.model.TrainingExamAttempt;
import ru.staffly.training.model.TrainingExamAssignment;
import ru.staffly.training.model.TrainingExamAttemptQuestion;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
class CertificationExpiredAttemptFinalizer {
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final ExamSnapshotService snapshotService;
    private final ExamAttemptEvaluator attemptEvaluator;
    private final CertificationAssignmentService assignmentService;

    /**
     * Finalizes stale unfinished certification attempt using the same scoring rules as submit,
     * but without new answers from client (read-repair / lifecycle recovery path).
     */
    public void finalizeExpiredAttempt(TrainingExamAttempt attempt, Instant now) {
        if (attempt.getFinishedAt() != null) {
            return;
        }

        var existingQuestions = attemptQuestions.findByAttemptId(attempt.getId());
        int scorePercent = calculateScorePercent(existingQuestions);

        attempt.setFinishedAt(now);
        attempt.setScorePercent(scorePercent);
        attempt.setPassed(scorePercent >= attempt.getPassPercentSnapshot());

        assignmentService.updateOnSubmit(attempt);
    }

    private int calculateScorePercent(List<TrainingExamAttemptQuestion> existingQuestions) {
        int correctAnswers = 0;
        for (var item : existingQuestions) {
            if (item.getChosenAnswerJson() == null || item.getChosenAnswerJson().isBlank()) {
                item.setChosenAnswerJson(null);
                item.setCorrect(false);
                continue;
            }

            var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());
            boolean correct = attemptEvaluator.isAnswerCorrect(item.getChosenAnswerJson(), item.getCorrectKeyJson(), snapshot.type());
            item.setCorrect(correct);
            if (correct) {
                correctAnswers++;
            }
        }

        if (existingQuestions.isEmpty()) {
            return 0;
        }
        return (int) Math.round((correctAnswers * 100.0) / existingQuestions.size());
    }
}
