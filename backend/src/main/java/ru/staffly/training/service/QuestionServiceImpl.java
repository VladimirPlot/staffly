package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {
    private final TrainingFolderRepository folders;
    private final TrainingQuestionRepository questions;
    private final TrainingQuestionOptionRepository options;
    private final TrainingQuestionMatchPairRepository pairs;
    private final TrainingQuestionBlankRepository blanks;
    private final TrainingQuestionBlankOptionRepository blankOptions;
    private final TrainingExamScopeRepository scopes;

    @Override
    public List<TrainingQuestionDto> listQuestions(Long restaurantId, Long folderId, boolean includeInactive, String query) {
        return toDtos(questions.listForFolder(restaurantId, folderId, includeInactive, query));
    }

    @Override
    @Transactional
    public TrainingQuestionDto createQuestion(Long restaurantId, CreateTrainingQuestionRequest request) {
        validateQuestionRequest(request.type(), request.title(), request.prompt(), request.options(), request.matchPairs(), request.blanks());
        var folder = folders.findByIdAndRestaurantId(request.folderId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Wrong folder type");

        var entity = questions.save(TrainingQuestion.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .type(request.type())
                .title(request.title().trim())
                .prompt(request.prompt().trim())
                .explanation(request.explanation())
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .active(true)
                .build());

        saveNested(entity, request.options(), request.matchPairs(), request.blanks());
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto updateQuestion(Long restaurantId, Long questionId, UpdateTrainingQuestionRequest request) {
        validateQuestionRequest(request.type(), request.title(), request.prompt(), request.options(), request.matchPairs(), request.blanks());
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Question not found"));

        entity.setTitle(request.title().trim());
        entity.setPrompt(request.prompt().trim());
        entity.setExplanation(request.explanation());
        entity.setType(request.type());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : request.sortOrder());
        entity.setActive(request.active() == null ? entity.isActive() : request.active());

        if (request.folderId() != null && !request.folderId().equals(entity.getFolder().getId())) {
            var folder = folders.findByIdAndRestaurantId(request.folderId(), restaurantId)
                    .orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Wrong folder type");
            entity.setFolder(folder);
        }

        clearNested(entity.getId());
        saveNested(entity, request.options(), request.matchPairs(), request.blanks());
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto hideQuestion(Long restaurantId, Long questionId) {
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Question not found"));
        entity.setActive(false);
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto restoreQuestion(Long restaurantId, Long questionId) {
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Question not found"));
        entity.setActive(true);
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public void deleteQuestion(Long restaurantId, Long questionId) {
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Question not found"));
        if (entity.isActive()) throw new ConflictException("Сначала скройте вопрос, затем удаляйте.");

        var usages = scopes.findExamUsagesByRestaurantIdAndQuestionId(restaurantId, questionId);
        if (!usages.isEmpty()) {
            throw new ConflictException(
                    "Вопрос используется в экзаменах. Уберите папку из области экзамена и повторите.",
                    Map.of("exams", usages)
            );
        }

        clearNested(entity.getId());
        questions.delete(entity);
    }

    private void clearNested(Long questionId) {
        options.deleteByQuestionId(questionId);
        pairs.deleteByQuestionId(questionId);

        var existingBlanks = blanks.findByQuestionIdOrderBySortOrderAscIdAsc(questionId);
        if (!existingBlanks.isEmpty()) {
            blankOptions.deleteByBlankIdIn(existingBlanks.stream().map(TrainingQuestionBlank::getId).toList());
            blanks.deleteByQuestionId(questionId);
        }
    }

    private void saveNested(
            TrainingQuestion question,
            List<TrainingQuestionOptionDto> optionDtos,
            List<TrainingQuestionMatchPairDto> pairDtos,
            List<TrainingQuestionBlankDto> blankDtos
    ) {
        if (optionDtos != null && !optionDtos.isEmpty()) {
            options.saveAll(optionDtos.stream()
                    .map(x -> TrainingQuestionOption.builder()
                            .question(question)
                            .text(x.text().trim())
                            .correct(Boolean.TRUE.equals(x.correct()))
                            .sortOrder(x.sortOrder() == null ? 0 : x.sortOrder())
                            .build())
                    .toList());
        }

        if (pairDtos != null && !pairDtos.isEmpty()) {
            pairs.saveAll(pairDtos.stream()
                    .map(x -> TrainingQuestionMatchPair.builder()
                            .question(question)
                            .leftText(x.leftText().trim())
                            .rightText(x.rightText().trim())
                            .sortOrder(x.sortOrder() == null ? 0 : x.sortOrder())
                            .build())
                    .toList());
        }

        if (blankDtos != null && !blankDtos.isEmpty()) {
            // FIX #2: не используем i внутри лямбды/stream.filter, строим map один раз
            var dtoByIndex = blankDtos.stream()
                    .collect(Collectors.toMap(
                            TrainingQuestionBlankDto::index,
                            b -> b,
                            (a, b) -> b
                    ));

            var blankEntities = blanks.saveAll(
                    blankDtos.stream()
                            .sorted(Comparator.comparing(TrainingQuestionBlankDto::index))
                            .map(x -> TrainingQuestionBlank.builder()
                                    .question(question)
                                    .sortOrder(x.index() == null ? 0 : x.index() - 1)
                                    .build())
                            .toList()
            );

            List<TrainingQuestionBlankOption> optionEntities = new ArrayList<>();
            for (int i = 0; i < blankEntities.size(); i++) {
                int index = i + 1; // 1..N
                var dto = dtoByIndex.get(index);
                if (dto == null) {
                    throw new BadRequestException("FILL_SELECT blank indexes must be 1..N without gaps");
                }

                for (int j = 0; j < dto.options().size(); j++) {
                    var o = dto.options().get(j);
                    optionEntities.add(TrainingQuestionBlankOption.builder()
                            .blank(blankEntities.get(i))
                            .text(o.text().trim())
                            .correct(Boolean.TRUE.equals(o.correct()))
                            .sortOrder(j)
                            .build());
                }
            }

            blankOptions.saveAll(optionEntities);
        }
    }

    private void validateQuestionRequest(
            TrainingQuestionType type,
            String title,
            String prompt,
            List<TrainingQuestionOptionDto> optionDtos,
            List<TrainingQuestionMatchPairDto> pairDtos,
            List<TrainingQuestionBlankDto> blankDtos
    ) {
        if (title == null || title.trim().isEmpty()) throw new BadRequestException("Название вопроса обязательно.");
        if (prompt == null || prompt.trim().isEmpty()) throw new BadRequestException("Формулировка вопроса обязательна.");

        if (type == TrainingQuestionType.MATCH) {
            if (pairDtos == null || pairDtos.size() < 2) throw new BadRequestException("MATCH requires at least 2 pairs");
            var pairSet = new HashSet<String>();
            for (var pair : pairDtos) {
                var left = pair.leftText() == null ? "" : pair.leftText().trim();
                var right = pair.rightText() == null ? "" : pair.rightText().trim();
                if (left.isEmpty() || right.isEmpty()) throw new BadRequestException("MATCH pairs must be complete");
                if (!pairSet.add((left + "|||" + right).toLowerCase())) throw new ConflictException("MATCH contains duplicate pairs");
            }
            return;
        }

        if (type == TrainingQuestionType.FILL_SELECT) {
            var indexes = parsePlaceholderIndexes(prompt);
            if (indexes.isEmpty()) throw new BadRequestException("FILL_SELECT prompt must contain placeholders like {{1}}");
            var expected = IntStream.rangeClosed(1, indexes.size()).boxed().toList();
            if (!indexes.equals(expected)) throw new BadRequestException("FILL_SELECT placeholders must be sequential: {{1}}..{{N}}");
            if (blankDtos == null || blankDtos.size() != indexes.size()) throw new BadRequestException("FILL_SELECT blanks must match placeholders count");

            var byIndex = blankDtos.stream().collect(Collectors.toMap(TrainingQuestionBlankDto::index, b -> b, (a, b) -> b));
            if (!byIndex.keySet().containsAll(expected) || byIndex.size() != expected.size()) {
                throw new BadRequestException("FILL_SELECT blank indexes must be 1..N without gaps");
            }
            for (Integer idx : expected) {
                validateBlankOptions(byIndex.get(idx));
            }
            return;
        }

        if (optionDtos == null || optionDtos.size() < 2) throw new BadRequestException("Question requires at least 2 options");
        Set<String> uniq = new HashSet<>();
        for (var opt : optionDtos) {
            var text = opt.text() == null ? "" : opt.text().trim();
            if (text.isEmpty()) throw new BadRequestException("Option text is required");
            if (!uniq.add(text.toLowerCase())) throw new ConflictException("Question contains duplicate options");
        }
        long correctCount = optionDtos.stream().filter(x -> Boolean.TRUE.equals(x.correct())).count();
        if (type == TrainingQuestionType.MULTI && correctCount < 1) throw new BadRequestException("MULTI requires at least one correct option");
        if ((type == TrainingQuestionType.SINGLE || type == TrainingQuestionType.TRUE_FALSE) && correctCount != 1) {
            throw new BadRequestException(type + " requires exactly one correct option");
        }
    }

    private void validateBlankOptions(TrainingQuestionBlankDto blankDto) {
        if (blankDto == null || blankDto.options() == null || blankDto.options().size() < 2) {
            throw new BadRequestException("Each blank requires at least 2 options");
        }
        Set<String> uniq = new HashSet<>();
        long correctCount = 0;
        for (var option : blankDto.options()) {
            var text = option.text() == null ? "" : option.text().trim();
            if (text.isEmpty()) throw new BadRequestException("Blank option text is required");
            if (!uniq.add(text.toLowerCase())) throw new ConflictException("Blank contains duplicate options");
            if (Boolean.TRUE.equals(option.correct())) correctCount++;
        }
        if (correctCount != 1) throw new BadRequestException("Each blank must contain exactly one correct option");
    }

    private List<Integer> parsePlaceholderIndexes(String prompt) {
        // FIX #1: правильная regex-строка для {{1}}, {{2}}, ...
        Pattern pattern = Pattern.compile("\\{\\{(\\d+)}}");
        var matcher = pattern.matcher(prompt == null ? "" : prompt);

        List<Integer> out = new ArrayList<>();
        while (matcher.find()) {
            out.add(Integer.parseInt(matcher.group(1)));
        }
        return out.stream().distinct().sorted().toList();
    }

    private List<TrainingQuestionDto> toDtos(List<TrainingQuestion> entities) {
        if (entities.isEmpty()) return List.of();
        var ids = entities.stream().map(TrainingQuestion::getId).toList();

        Map<Long, List<TrainingQuestionOptionDto>> optionsByQuestion = options.findByQuestionIdInOrderBySortOrderAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(
                        o -> o.getQuestion().getId(),
                        Collectors.mapping(
                                o -> new TrainingQuestionOptionDto(o.getId(), o.getText(), o.isCorrect(), o.getSortOrder()),
                                Collectors.toList()
                        )
                ));

        Map<Long, List<TrainingQuestionMatchPairDto>> pairsByQuestion = pairs.findByQuestionIdInOrderBySortOrderAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(
                        p -> p.getQuestion().getId(),
                        Collectors.mapping(
                                p -> new TrainingQuestionMatchPairDto(p.getId(), p.getLeftText(), p.getRightText(), p.getSortOrder()),
                                Collectors.toList()
                        )
                ));

        var blankEntities = blanks.findByQuestionIdInOrderBySortOrderAscIdAsc(ids);
        var blankIds = blankEntities.stream().map(TrainingQuestionBlank::getId).toList();

        Map<Long, List<TrainingQuestionBlankOptionDto>> optionsByBlank =
                blankIds.isEmpty()
                        ? Map.of()
                        : blankOptions.findByBlankIdInOrderBySortOrderAscIdAsc(blankIds).stream()
                        .collect(Collectors.groupingBy(
                                o -> o.getBlank().getId(),
                                Collectors.mapping(
                                        o -> new TrainingQuestionBlankOptionDto(o.getId(), o.getText(), o.isCorrect(), o.getSortOrder()),
                                        Collectors.toList()
                                )
                        ));

        Map<Long, List<TrainingQuestionBlankDto>> blanksByQuestion = blankEntities.stream()
                .collect(Collectors.groupingBy(
                        b -> b.getQuestion().getId(),
                        Collectors.mapping(
                                b -> new TrainingQuestionBlankDto(
                                        b.getId(),
                                        b.getSortOrder() + 1,
                                        optionsByBlank.getOrDefault(b.getId(), List.of())
                                ),
                                Collectors.toList()
                        )
                ));

        return entities.stream()
                .map(q -> new TrainingQuestionDto(
                        q.getId(),
                        q.getRestaurant().getId(),
                        q.getFolder().getId(),
                        q.getType(),
                        q.getTitle(),
                        q.getPrompt(),
                        q.getExplanation(),
                        q.getSortOrder(),
                        q.isActive(),
                        optionsByQuestion.getOrDefault(q.getId(), List.of()),
                        pairsByQuestion.getOrDefault(q.getId(), List.of()),
                        blanksByQuestion.getOrDefault(q.getId(), List.of())
                ))
                .toList();
    }
}