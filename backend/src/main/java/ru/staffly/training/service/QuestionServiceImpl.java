package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.model.TrainingQuestion;
import ru.staffly.training.model.TrainingQuestionBlank;
import ru.staffly.training.repository.*;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestionServiceImpl implements QuestionService {
    private final TrainingFolderRepository folders;
    private final TrainingQuestionRepository questions;
    private final TrainingQuestionOptionRepository options;
    private final TrainingQuestionMatchPairRepository pairs;
    private final TrainingQuestionBlankRepository blanks;
    private final TrainingQuestionBlankOptionRepository blankOptions;
    private final TrainingExamSourceQuestionRepository questionSources;
    private final TrainingQuestionValidator validator;
    private final TrainingQuestionNestedPersistence nestedPersistence;
    private final TrainingPolicyService trainingPolicyService;

    @Override
    public List<TrainingQuestionDto> listQuestions(Long restaurantId, Long userId, Long folderId, ru.staffly.training.model.TrainingQuestionGroup questionGroup, boolean includeInactive, String query) {
        var folder = requireQuestionBankFolder(restaurantId, folderId);
        trainingPolicyService.assertCanAccessQuestionBankByVisibility(
                userId,
                restaurantId,
                folder.getVisibilityPositions().stream().map(position -> position.getId()).collect(Collectors.toSet())
        );
        return toDtos(questions.listForFolder(restaurantId, folderId, questionGroup, includeInactive, query));
    }

    @Override
    @Transactional
    public TrainingQuestionDto createQuestion(Long restaurantId, CreateTrainingQuestionRequest request) {
        validator.validateQuestion(request.type(), request.title(), request.prompt(), request.options(), request.matchPairs(), request.blanks());

        var folder = requireQuestionBankFolder(restaurantId, request.folderId());
        var entity = questions.save(TrainingQuestion.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .type(request.type())
                .questionGroup(request.questionGroup())
                .title(request.title().trim())
                .prompt(request.prompt().trim())
                .explanation(request.explanation())
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .active(true)
                .build());

        nestedPersistence.saveNested(entity, request.options(), request.matchPairs(), request.blanks());
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto updateQuestion(Long restaurantId, Long questionId, UpdateTrainingQuestionRequest request) {
        validator.validateQuestion(request.type(), request.title(), request.prompt(), request.options(), request.matchPairs(), request.blanks());

        var entity = questions.findByIdAndRestaurantId(questionId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Question not found"));

        entity.setTitle(request.title().trim());
        entity.setPrompt(request.prompt().trim());
        entity.setExplanation(request.explanation());
        entity.setType(request.type());
        entity.setQuestionGroup(request.questionGroup());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : request.sortOrder());
        entity.setActive(request.active() == null ? entity.isActive() : request.active());

        if (request.folderId() != null && !Objects.equals(request.folderId(), entity.getFolder().getId())) {
            entity.setFolder(requireQuestionBankFolder(restaurantId, request.folderId()));
        }

        nestedPersistence.replaceNested(entity, request.options(), request.matchPairs(), request.blanks());
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
        if (entity.isActive()) {
            throw new ConflictException("Сначала скройте вопрос, затем удаляйте.");
        }

        var usages = questionSources.findExamUsagesByRestaurantIdAndQuestionId(restaurantId, questionId);
        if (!usages.isEmpty()) {
            throw new ConflictException(
                    "Вопрос используется в экзаменах. Уберите папку из области экзамена и повторите.",
                    Map.of("exams", usages)
            );
        }

        nestedPersistence.clearNested(entity.getId());
        questions.delete(entity);
    }

    private ru.staffly.training.model.TrainingFolder requireQuestionBankFolder(Long restaurantId, Long folderId) {
        var folder = folders.findByIdAndRestaurantId(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.QUESTION_BANK) {
            throw new BadRequestException("Wrong folder type");
        }
        return folder;
    }

    private List<TrainingQuestionDto> toDtos(List<TrainingQuestion> entities) {
        if (entities.isEmpty()) {
            return List.of();
        }
        var ids = entities.stream().map(TrainingQuestion::getId).toList();

        Map<Long, List<TrainingQuestionOptionDto>> optionsByQuestion = options.findByQuestionIdInOrderBySortOrderAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(
                        option -> option.getQuestion().getId(),
                        Collectors.mapping(
                                option -> new TrainingQuestionOptionDto(option.getId(), option.getText(), option.isCorrect(), option.getSortOrder()),
                                Collectors.toList()
                        )
                ));

        Map<Long, List<TrainingQuestionMatchPairDto>> pairsByQuestion = pairs.findByQuestionIdInOrderBySortOrderAscIdAsc(ids).stream()
                .collect(Collectors.groupingBy(
                        pair -> pair.getQuestion().getId(),
                        Collectors.mapping(
                                pair -> new TrainingQuestionMatchPairDto(pair.getId(), pair.getLeftText(), pair.getRightText(), pair.getSortOrder()),
                                Collectors.toList()
                        )
                ));

        var blankEntities = blanks.findByQuestionIdInOrderBySortOrderAscIdAsc(ids);
        var blankIds = blankEntities.stream().map(TrainingQuestionBlank::getId).toList();

        Map<Long, List<TrainingQuestionBlankOptionDto>> optionsByBlank = blankIds.isEmpty()
                ? Map.of()
                : blankOptions.findByBlankIdInOrderBySortOrderAscIdAsc(blankIds).stream()
                .collect(Collectors.groupingBy(
                        option -> option.getBlank().getId(),
                        Collectors.mapping(
                                option -> new TrainingQuestionBlankOptionDto(option.getId(), option.getText(), option.isCorrect(), option.getSortOrder()),
                                Collectors.toList()
                        )
                ));

        Map<Long, List<TrainingQuestionBlankDto>> blanksByQuestion = blankEntities.stream()
                .collect(Collectors.groupingBy(
                        blank -> blank.getQuestion().getId(),
                        Collectors.mapping(
                                blank -> new TrainingQuestionBlankDto(
                                        blank.getId(),
                                        blank.getSortOrder() + 1,
                                        optionsByBlank.getOrDefault(blank.getId(), List.of())
                                ),
                                Collectors.toList()
                        )
                ));

        return entities.stream()
                .map(question -> new TrainingQuestionDto(
                        question.getId(),
                        question.getRestaurant().getId(),
                        question.getFolder().getId(),
                        question.getType(),
                        question.getQuestionGroup(),
                        question.getTitle(),
                        question.getPrompt(),
                        question.getExplanation(),
                        question.getSortOrder(),
                        question.isActive(),
                        optionsByQuestion.getOrDefault(question.getId(), List.of()),
                        pairsByQuestion.getOrDefault(question.getId(), List.of()),
                        blanksByQuestion.getOrDefault(question.getId(), List.of())
                ))
                .toList();
    }
}
