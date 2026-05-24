package ru.staffly.training.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;

import java.util.Comparator;
import java.util.List;

@Component
@RequiredArgsConstructor
class ExamSnapshotService {
    private final ObjectMapper objectMapper;

    SnapshotPayload buildSnapshot(TrainingQuestion question,
                                  List<TrainingQuestionOption> options,
                                  List<TrainingQuestionMatchPair> pairs,
                                  List<TrainingQuestionBlank> blanks,
                                  java.util.Map<Long, List<TrainingQuestionBlankOption>> blankOptionsByBlank) {
        try {
            var optionView = options.stream()
                    .map(option -> new TrainingQuestionOptionViewDto(option.getSortOrder(), option.getText()))
                    .toList();
            var pairView = pairs.stream()
                    .map(pair -> new TrainingQuestionMatchPairViewDto(pair.getSortOrder(), pair.getLeftText(), pair.getRightText()))
                    .toList();
            var blankView = blanks.stream()
                    .sorted(Comparator.comparing(TrainingQuestionBlank::getSortOrder))
                    .map(blank -> new TrainingQuestionBlankViewDto(
                            blank.getSortOrder() + 1,
                            blankOptionsByBlank.getOrDefault(blank.getId(), List.of()).stream()
                                    .map(option -> new TrainingQuestionBlankOptionViewDto(option.getSortOrder(), option.getText()))
                                    .toList()
                    ))
                    .toList();

            var snapshotDto = new AttemptQuestionSnapshotDto(
                    question.getId(),
                    question.getType(),
                    question.getPrompt(),
                    question.getExplanation(),
                    optionView,
                    pairView,
                    blankView
            );

            return new SnapshotPayload(
                    snapshotDto,
                    objectMapper.writeValueAsString(snapshotDto),
                    serializeCorrectKey(question.getType(), options, pairs, blanks, blankOptionsByBlank)
            );
        } catch (Exception exception) {
            throw new BadRequestException("Cannot serialize exam snapshot");
        }
    }

    AttemptQuestionSnapshotDto readSnapshot(String snapshotJson) {
        try {
            return objectMapper.readValue(snapshotJson, AttemptQuestionSnapshotDto.class);
        } catch (Exception exception) {
            throw new BadRequestException("Invalid question snapshot");
        }
    }

    private String serializeCorrectKey(TrainingQuestionType type,
                                       List<TrainingQuestionOption> options,
                                       List<TrainingQuestionMatchPair> pairs,
                                       List<TrainingQuestionBlank> blanks,
                                       java.util.Map<Long, List<TrainingQuestionBlankOption>> blankOptionsByBlank) throws Exception {
        if (type == TrainingQuestionType.MATCH) {
            var key = pairs.stream()
                    .map(pair -> new MatchPairAnswer(pair.getLeftText(), pair.getRightText()))
                    .sorted(Comparator.comparing(MatchPairAnswer::left))
                    .toList();
            return objectMapper.writeValueAsString(key);
        }

        if (type == TrainingQuestionType.MULTI) {
            var key = options.stream()
                    .filter(TrainingQuestionOption::isCorrect)
                    .map(TrainingQuestionOption::getText)
                    .sorted()
                    .toList();
            return objectMapper.writeValueAsString(key);
        }

        if (type == TrainingQuestionType.FILL_SELECT && !blanks.isEmpty()) {
            var key = blanks.stream()
                    .sorted(Comparator.comparing(TrainingQuestionBlank::getSortOrder))
                    .map(blank -> {
                        var correct = blankOptionsByBlank.getOrDefault(blank.getId(), List.of()).stream()
                                .filter(TrainingQuestionBlankOption::isCorrect)
                                .map(TrainingQuestionBlankOption::getText)
                                .findFirst()
                                .orElse("");
                        return new FillBlankCorrectAnswer(blank.getSortOrder() + 1, correct);
                    })
                    .toList();
            return objectMapper.writeValueAsString(key);
        }

        var singleKey = options.stream()
                .filter(TrainingQuestionOption::isCorrect)
                .map(TrainingQuestionOption::getText)
                .findFirst()
                .orElse("");
        return objectMapper.writeValueAsString(singleKey);
    }

    record SnapshotPayload(AttemptQuestionSnapshotDto snapshotDto, String snapshotJson, String correctKeyJson) {}

    private record MatchPairAnswer(String left, String right) {}

    private record FillBlankCorrectAnswer(Integer blankIndex, String correct) {}
}
