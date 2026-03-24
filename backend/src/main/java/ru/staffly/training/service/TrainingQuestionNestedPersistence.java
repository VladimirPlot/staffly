package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.dto.TrainingQuestionBlankDto;
import ru.staffly.training.dto.TrainingQuestionMatchPairDto;
import ru.staffly.training.dto.TrainingQuestionOptionDto;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
class TrainingQuestionNestedPersistence {
    private final TrainingQuestionOptionRepository options;
    private final TrainingQuestionMatchPairRepository pairs;
    private final TrainingQuestionBlankRepository blanks;
    private final TrainingQuestionBlankOptionRepository blankOptions;

    void replaceNested(TrainingQuestion question,
                       List<TrainingQuestionOptionDto> optionDtos,
                       List<TrainingQuestionMatchPairDto> pairDtos,
                       List<TrainingQuestionBlankDto> blankDtos) {
        clearNested(question.getId());
        saveNested(question, optionDtos, pairDtos, blankDtos);
    }

    void clearNested(Long questionId) {
        options.deleteByQuestionId(questionId);
        pairs.deleteByQuestionId(questionId);

        var existingBlanks = blanks.findByQuestionIdOrderBySortOrderAscIdAsc(questionId);
        if (existingBlanks.isEmpty()) {
            return;
        }

        blankOptions.deleteByBlankIdIn(existingBlanks.stream().map(TrainingQuestionBlank::getId).toList());
        blanks.deleteByQuestionId(questionId);
    }

    void saveNested(TrainingQuestion question,
                    List<TrainingQuestionOptionDto> optionDtos,
                    List<TrainingQuestionMatchPairDto> pairDtos,
                    List<TrainingQuestionBlankDto> blankDtos) {
        saveOptions(question, optionDtos);
        savePairs(question, pairDtos);
        saveBlanks(question, blankDtos);
    }

    private void saveOptions(TrainingQuestion question, List<TrainingQuestionOptionDto> optionDtos) {
        if (optionDtos == null || optionDtos.isEmpty()) {
            return;
        }

        options.saveAll(optionDtos.stream()
                .map(option -> TrainingQuestionOption.builder()
                        .question(question)
                        .text(option.text().trim())
                        .correct(Boolean.TRUE.equals(option.correct()))
                        .sortOrder(option.sortOrder() == null ? 0 : option.sortOrder())
                        .build())
                .toList());
    }

    private void savePairs(TrainingQuestion question, List<TrainingQuestionMatchPairDto> pairDtos) {
        if (pairDtos == null || pairDtos.isEmpty()) {
            return;
        }

        pairs.saveAll(pairDtos.stream()
                .map(pair -> TrainingQuestionMatchPair.builder()
                        .question(question)
                        .leftText(pair.leftText().trim())
                        .rightText(pair.rightText().trim())
                        .sortOrder(pair.sortOrder() == null ? 0 : pair.sortOrder())
                        .build())
                .toList());
    }

    private void saveBlanks(TrainingQuestion question, List<TrainingQuestionBlankDto> blankDtos) {
        if (blankDtos == null || blankDtos.isEmpty()) {
            return;
        }

        var blankDtoByIndex = blankDtos.stream()
                .collect(Collectors.toMap(TrainingQuestionBlankDto::index, blank -> blank, (first, second) -> second));

        var blankEntities = blanks.saveAll(
                blankDtos.stream()
                        .sorted(Comparator.comparing(TrainingQuestionBlankDto::index))
                        .map(blank -> TrainingQuestionBlank.builder()
                                .question(question)
                                .sortOrder(blank.index() == null ? 0 : blank.index() - 1)
                                .build())
                        .toList()
        );

        List<TrainingQuestionBlankOption> optionEntities = new ArrayList<>();
        for (int blankPos = 0; blankPos < blankEntities.size(); blankPos++) {
            int expectedIndex = blankPos + 1;
            var blankDto = blankDtoByIndex.get(expectedIndex);
            if (blankDto == null) {
                throw new BadRequestException("FILL_SELECT blank indexes must be 1..N without gaps");
            }

            for (int optionPos = 0; optionPos < blankDto.options().size(); optionPos++) {
                var blankOption = blankDto.options().get(optionPos);
                optionEntities.add(TrainingQuestionBlankOption.builder()
                        .blank(blankEntities.get(blankPos))
                        .text(blankOption.text().trim())
                        .correct(Boolean.TRUE.equals(blankOption.correct()))
                        .sortOrder(optionPos)
                        .build());
            }
        }

        blankOptions.saveAll(optionEntities);
    }
}
