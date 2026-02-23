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
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {
    private final TrainingFolderRepository folders;
    private final TrainingQuestionRepository questions;
    private final TrainingQuestionOptionRepository options;
    private final TrainingQuestionMatchPairRepository pairs;
    private final TrainingExamScopeRepository scopes;

    @Override
    public List<TrainingQuestionDto> listQuestions(Long restaurantId, Long folderId, boolean includeInactive) {
        var entities = includeInactive
                ? questions.findByRestaurantIdAndFolderIdOrderBySortOrderAscIdAsc(restaurantId, folderId)
                : questions.findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscIdAsc(restaurantId, folderId);
        return toDtos(entities);
    }

    @Override
    @Transactional
    public TrainingQuestionDto createQuestion(Long restaurantId, CreateTrainingQuestionRequest request) {
        validateQuestionRequest(request.type(), request.options(), request.matchPairs());
        var folder = folders.findByIdAndRestaurantId(request.folderId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Wrong folder type");
        var entity = questions.save(TrainingQuestion.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .type(request.type())
                .prompt(request.prompt())
                .explanation(request.explanation())
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .active(true)
                .build());
        saveNested(entity, request.options(), request.matchPairs());
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto updateQuestion(Long restaurantId, Long questionId, UpdateTrainingQuestionRequest request) {
        validateQuestionRequest(request.type(), request.options(), request.matchPairs());
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId).orElseThrow(() -> new NotFoundException("Question not found"));
        entity.setPrompt(request.prompt());
        entity.setExplanation(request.explanation());
        entity.setType(request.type());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : request.sortOrder());
        entity.setActive(request.active() == null ? entity.isActive() : request.active());
        if (request.folderId() != null && !request.folderId().equals(entity.getFolder().getId())) {
            var folder = folders.findByIdAndRestaurantId(request.folderId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Wrong folder type");
            entity.setFolder(folder);
        }
        options.deleteByQuestionId(entity.getId());
        pairs.deleteByQuestionId(entity.getId());
        saveNested(entity, request.options(), request.matchPairs());
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public void deleteQuestion(Long restaurantId, Long questionId) {
        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId).orElseThrow(() -> new NotFoundException("Question not found"));
        var usages = scopes.findExamUsagesByRestaurantIdAndFolderIds(restaurantId, List.of(entity.getFolder().getId()));
        if (!usages.isEmpty()) {
            throw new ConflictException("Question is used in exams", Map.of("exams", usages));
        }
        options.deleteByQuestionId(entity.getId());
        pairs.deleteByQuestionId(entity.getId());
        questions.delete(entity);
    }

    private void saveNested(TrainingQuestion question, List<TrainingQuestionOptionDto> optionDtos, List<TrainingQuestionMatchPairDto> pairDtos) {
        if (optionDtos != null && !optionDtos.isEmpty()) {
            options.saveAll(optionDtos.stream().map(x -> TrainingQuestionOption.builder()
                    .question(question).text(x.text()).correct(Boolean.TRUE.equals(x.correct())).sortOrder(x.sortOrder() == null ? 0 : x.sortOrder()).build()).toList());
        }
        if (pairDtos != null && !pairDtos.isEmpty()) {
            pairs.saveAll(pairDtos.stream().map(x -> TrainingQuestionMatchPair.builder()
                    .question(question).leftText(x.leftText()).rightText(x.rightText()).sortOrder(x.sortOrder() == null ? 0 : x.sortOrder()).build()).toList());
        }
    }

    private void validateQuestionRequest(TrainingQuestionType type, List<TrainingQuestionOptionDto> optionDtos, List<TrainingQuestionMatchPairDto> pairDtos) {
        if (type == TrainingQuestionType.MATCH) {
            if (pairDtos == null || pairDtos.size() < 2) throw new BadRequestException("MATCH requires at least 2 pairs");
            return;
        }
        if (optionDtos == null || optionDtos.size() < 2) throw new BadRequestException("Question requires at least 2 options");
        long correctCount = optionDtos.stream().filter(x -> Boolean.TRUE.equals(x.correct())).count();
        if (type == TrainingQuestionType.MULTI && correctCount < 1) throw new BadRequestException("MULTI requires at least one correct option");
        if ((type == TrainingQuestionType.SINGLE || type == TrainingQuestionType.TRUE_FALSE || type == TrainingQuestionType.FILL_SELECT) && correctCount != 1) {
            throw new BadRequestException(type + " requires exactly one correct option");
        }
    }

    private List<TrainingQuestionDto> toDtos(List<TrainingQuestion> entities) {
        if (entities.isEmpty()) return List.of();
        var ids = entities.stream().map(TrainingQuestion::getId).toList();
        Map<Long, List<TrainingQuestionOptionDto>> optionsByQuestion = options.findByQuestionIdInOrderBySortOrderAscIdAsc(ids)
                .stream().collect(Collectors.groupingBy(o -> o.getQuestion().getId(), Collectors.mapping(o -> new TrainingQuestionOptionDto(o.getId(), o.getText(), o.isCorrect(), o.getSortOrder()), Collectors.toList())));
        Map<Long, List<TrainingQuestionMatchPairDto>> pairsByQuestion = pairs.findByQuestionIdInOrderBySortOrderAscIdAsc(ids)
                .stream().collect(Collectors.groupingBy(p -> p.getQuestion().getId(), Collectors.mapping(p -> new TrainingQuestionMatchPairDto(p.getId(), p.getLeftText(), p.getRightText(), p.getSortOrder()), Collectors.toList())));

        return entities.stream().map(q -> new TrainingQuestionDto(q.getId(), q.getRestaurant().getId(), q.getFolder().getId(), q.getType(), q.getPrompt(), q.getExplanation(), q.getSortOrder(), q.isActive(),
                optionsByQuestion.getOrDefault(q.getId(), List.of()),
                pairsByQuestion.getOrDefault(q.getId(), List.of()))).toList();
    }
}
