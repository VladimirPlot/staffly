package ru.staffly.training.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.TrainingQuestionType;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class TrainingMatchValidationTest {
    final TrainingQuestionValidator validator = new TrainingQuestionValidator();

    void validate(String left, String right) {
        validator.validateQuestion(TrainingQuestionType.MATCH, "Title", "Prompt", List.of(),
                List.of(new TrainingQuestionMatchPairDto(null, "A", "X", 0),
                        new TrainingQuestionMatchPairDto(null, left, right, 1)), List.of());
    }

    @Test void rejectsRepeatedValuesOnEitherSideIncludingWhitespaceAndCase() {
        assertThrows(ConflictException.class, () -> validate("B", "X"));
        assertThrows(ConflictException.class, () -> validate("A", "Y"));
        assertThrows(ConflictException.class, () -> validate(" a ", "Y"));
        assertThrows(ConflictException.class, () -> validate("B", " x "));
    }

    @Test void validQuestionCanBeAnsweredAndGraded() {
        validate("B", "Y");
        var evaluator = new ExamAttemptEvaluator(new ObjectMapper());
        var snapshot = new AttemptQuestionSnapshotDto(1L, TrainingQuestionType.MATCH, "Prompt", null,
                List.of(), List.of(new TrainingQuestionMatchPairViewDto(0, "A", "X"),
                new TrainingQuestionMatchPairViewDto(1, "B", "Y")), List.of());
        String answer = "[{\"left\":\"B\",\"right\":\"Y\"},{\"left\":\"A\",\"right\":\"X\"}]";
        assertDoesNotThrow(() -> evaluator.validateAnswerForType(answer, snapshot));
        assertTrue(evaluator.isAnswerCorrect(answer, answer, TrainingQuestionType.MATCH));
        assertFalse(evaluator.isAnswerCorrect("[{\"left\":\"A\",\"right\":\"Y\"},{\"left\":\"B\",\"right\":\"X\"}]", answer, TrainingQuestionType.MATCH));
    }
}
