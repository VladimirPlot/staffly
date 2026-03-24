package ru.staffly.training.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.TrainingQuestionType;

import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
class ExamAttemptEvaluator {
    private final ObjectMapper objectMapper;

    void validateAnswerForType(String answerJson, AttemptQuestionSnapshotDto snapshot) {
        try {
            switch (snapshot.type()) {
                case MATCH -> validateMatchAnswer(answerJson, snapshot);
                case MULTI -> validateMultiAnswer(answerJson, snapshot);
                case FILL_SELECT -> validateFillSelectAnswer(answerJson, snapshot);
                default -> validateSingleChoiceAnswer(answerJson, snapshot);
            }
        } catch (BadRequestException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BadRequestException("Invalid answer format");
        }
    }

    boolean isAnswerCorrect(String answerJson, String correctKeyJson, TrainingQuestionType type) {
        try {
            if (type == TrainingQuestionType.MATCH) {
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<MatchPairAnswer>>() {}).stream()
                        .sorted(Comparator.comparing(MatchPairAnswer::left))
                        .toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<MatchPairAnswer>>() {}).stream()
                        .sorted(Comparator.comparing(MatchPairAnswer::left))
                        .toList();
                return expected.equals(actual);
            }

            if (type == TrainingQuestionType.MULTI) {
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<String>>() {}).stream().sorted().toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<String>>() {}).stream().sorted().toList();
                return expected.equals(actual);
            }

            if (type == TrainingQuestionType.FILL_SELECT && correctKeyJson != null && correctKeyJson.trim().startsWith("[")) {
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<FillBlankAnswer>>() {}).stream()
                        .sorted(Comparator.comparing(FillBlankAnswer::blankIndex))
                        .toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<FillBlankCorrectAnswer>>() {}).stream()
                        .sorted(Comparator.comparing(FillBlankCorrectAnswer::blankIndex))
                        .toList();
                if (actual.size() != expected.size()) {
                    return false;
                }
                for (int index = 0; index < expected.size(); index++) {
                    if (!Objects.equals(expected.get(index).blankIndex(), actual.get(index).blankIndex())
                            || !Objects.equals(expected.get(index).correct(), actual.get(index).value())) {
                        return false;
                    }
                }
                return true;
            }

            String actual = objectMapper.readValue(answerJson, String.class);
            String expected = objectMapper.readValue(correctKeyJson, String.class);
            return Objects.equals(expected, actual);
        } catch (Exception exception) {
            throw new BadRequestException("Invalid answer payload");
        }
    }

    private void validateMatchAnswer(String answerJson, AttemptQuestionSnapshotDto snapshot) throws Exception {
        var answerPairs = objectMapper.readValue(answerJson, new TypeReference<List<MatchPairAnswer>>() {});
        var allowedLeft = snapshot.matchPairs().stream().map(TrainingQuestionMatchPairViewDto::leftText).collect(Collectors.toSet());
        var allowedRight = snapshot.matchPairs().stream().map(TrainingQuestionMatchPairViewDto::rightText).collect(Collectors.toSet());
        if (answerPairs.size() != allowedLeft.size()) {
            throw new BadRequestException("Invalid answer values");
        }

        var lefts = new HashSet<String>();
        var rights = new HashSet<String>();
        for (var pair : answerPairs) {
            if (!allowedLeft.contains(pair.left())
                    || !allowedRight.contains(pair.right())
                    || !lefts.add(pair.left())
                    || !rights.add(pair.right())) {
                throw new BadRequestException("Invalid answer values");
            }
        }
    }

    private void validateMultiAnswer(String answerJson, AttemptQuestionSnapshotDto snapshot) throws Exception {
        var values = objectMapper.readValue(answerJson, new TypeReference<List<String>>() {});
        var allowed = snapshot.options().stream().map(TrainingQuestionOptionViewDto::text).collect(Collectors.toSet());
        if (!allowed.containsAll(values)) {
            throw new BadRequestException("Invalid answer values");
        }
    }

    private void validateFillSelectAnswer(String answerJson, AttemptQuestionSnapshotDto snapshot) throws Exception {
        if (snapshot.blanks() == null || snapshot.blanks().isEmpty()) {
            validateSingleChoiceAnswer(answerJson, snapshot);
            return;
        }

        var values = objectMapper.readValue(answerJson, new TypeReference<List<FillBlankAnswer>>() {});
        if (values.size() != snapshot.blanks().size()) {
            throw new BadRequestException("Invalid answer values");
        }

        var byIndex = values.stream().collect(Collectors.toMap(FillBlankAnswer::blankIndex, FillBlankAnswer::value, (first, second) -> second));
        if (byIndex.size() != values.size()) {
            throw new BadRequestException("Invalid answer values");
        }

        for (var blank : snapshot.blanks()) {
            var value = byIndex.get(blank.blankIndex());
            if (value == null) {
                throw new BadRequestException("Invalid answer values");
            }
            var allowed = blank.options().stream().map(TrainingQuestionBlankOptionViewDto::text).collect(Collectors.toSet());
            if (!allowed.contains(value)) {
                throw new BadRequestException("Invalid answer values");
            }
        }
    }

    private void validateSingleChoiceAnswer(String answerJson, AttemptQuestionSnapshotDto snapshot) throws Exception {
        var value = objectMapper.readValue(answerJson, String.class);
        var allowed = snapshot.options().stream().map(TrainingQuestionOptionViewDto::text).collect(Collectors.toSet());
        if (!allowed.contains(value)) {
            throw new BadRequestException("Invalid answer values");
        }
    }

    private record MatchPairAnswer(String left, String right) {}

    private record FillBlankAnswer(Integer blankIndex, String value) {}

    private record FillBlankCorrectAnswer(Integer blankIndex, String correct) {}
}
