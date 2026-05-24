package ru.staffly.training.service;

import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.training.dto.TrainingQuestionBlankDto;
import ru.staffly.training.dto.TrainingQuestionOptionDto;
import ru.staffly.training.dto.TrainingQuestionMatchPairDto;
import ru.staffly.training.model.TrainingQuestionType;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Component
class TrainingQuestionValidator {
    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{(\\d+)}}");

    void validateQuestion(TrainingQuestionType type,
                          String title,
                          String prompt,
                          List<TrainingQuestionOptionDto> optionDtos,
                          List<TrainingQuestionMatchPairDto> pairDtos,
                          List<TrainingQuestionBlankDto> blankDtos) {
        validateBaseFields(title, prompt);

        if (type == TrainingQuestionType.MATCH) {
            validateMatchQuestion(pairDtos);
            return;
        }

        if (type == TrainingQuestionType.FILL_SELECT) {
            validateFillSelectQuestion(prompt, blankDtos);
            return;
        }

        validateChoiceQuestion(type, optionDtos);
    }

    private void validateBaseFields(String title, String prompt) {
        if (title == null || title.trim().isEmpty()) {
            throw new BadRequestException("Название вопроса обязательно.");
        }
        if (prompt == null || prompt.trim().isEmpty()) {
            throw new BadRequestException("Формулировка вопроса обязательна.");
        }
    }

    private void validateMatchQuestion(List<TrainingQuestionMatchPairDto> pairDtos) {
        if (pairDtos == null || pairDtos.size() < 2) {
            throw new BadRequestException("MATCH requires at least 2 pairs");
        }
        var uniquePairs = new HashSet<String>();
        for (var pair : pairDtos) {
            var left = pair.leftText() == null ? "" : pair.leftText().trim();
            var right = pair.rightText() == null ? "" : pair.rightText().trim();
            if (left.isEmpty() || right.isEmpty()) {
                throw new BadRequestException("MATCH pairs must be complete");
            }
            if (!uniquePairs.add((left + "|||" + right).toLowerCase())) {
                throw new ConflictException("MATCH contains duplicate pairs");
            }
        }
    }

    private void validateFillSelectQuestion(String prompt, List<TrainingQuestionBlankDto> blankDtos) {
        var indexes = parsePlaceholderIndexes(prompt);
        if (indexes.isEmpty()) {
            throw new BadRequestException("FILL_SELECT prompt must contain placeholders like {{1}}");
        }

        var expected = IntStream.rangeClosed(1, indexes.size()).boxed().toList();
        if (!indexes.equals(expected)) {
            throw new BadRequestException("FILL_SELECT placeholders must be sequential: {{1}}..{{N}}");
        }

        if (blankDtos == null || blankDtos.size() != indexes.size()) {
            throw new BadRequestException("FILL_SELECT blanks must match placeholders count");
        }

        var byIndex = blankDtos.stream()
                .collect(Collectors.toMap(TrainingQuestionBlankDto::index, blank -> blank, (first, second) -> second));
        if (!byIndex.keySet().containsAll(expected) || byIndex.size() != expected.size()) {
            throw new BadRequestException("FILL_SELECT blank indexes must be 1..N without gaps");
        }

        for (Integer index : expected) {
            validateBlankOptions(byIndex.get(index));
        }
    }

    private void validateChoiceQuestion(TrainingQuestionType type, List<TrainingQuestionOptionDto> optionDtos) {
        if (optionDtos == null || optionDtos.size() < 2) {
            throw new BadRequestException("Question requires at least 2 options");
        }

        Set<String> uniqueOptions = new HashSet<>();
        for (var option : optionDtos) {
            var text = option.text() == null ? "" : option.text().trim();
            if (text.isEmpty()) {
                throw new BadRequestException("Option text is required");
            }
            if (!uniqueOptions.add(text.toLowerCase())) {
                throw new ConflictException("Question contains duplicate options");
            }
        }

        long correctCount = optionDtos.stream().filter(option -> Boolean.TRUE.equals(option.correct())).count();
        if (type == TrainingQuestionType.MULTI && correctCount < 1) {
            throw new BadRequestException("MULTI requires at least one correct option");
        }
        if ((type == TrainingQuestionType.SINGLE || type == TrainingQuestionType.TRUE_FALSE) && correctCount != 1) {
            throw new BadRequestException(type + " requires exactly one correct option");
        }
    }

    private void validateBlankOptions(TrainingQuestionBlankDto blankDto) {
        if (blankDto == null || blankDto.options() == null || blankDto.options().size() < 2) {
            throw new BadRequestException("Each blank requires at least 2 options");
        }

        Set<String> uniqueOptions = new HashSet<>();
        long correctCount = 0;
        for (var option : blankDto.options()) {
            var text = option.text() == null ? "" : option.text().trim();
            if (text.isEmpty()) {
                throw new BadRequestException("Blank option text is required");
            }
            if (!uniqueOptions.add(text.toLowerCase())) {
                throw new ConflictException("Blank contains duplicate options");
            }
            if (Boolean.TRUE.equals(option.correct())) {
                correctCount++;
            }
        }

        if (correctCount != 1) {
            throw new BadRequestException("Each blank must contain exactly one correct option");
        }
    }

    private List<Integer> parsePlaceholderIndexes(String prompt) {
        var matcher = PLACEHOLDER_PATTERN.matcher(prompt == null ? "" : prompt);
        List<Integer> indexes = new ArrayList<>();
        while (matcher.find()) {
            indexes.add(Integer.parseInt(matcher.group(1)));
        }
        return indexes.stream().distinct().sorted().toList();
    }
}
