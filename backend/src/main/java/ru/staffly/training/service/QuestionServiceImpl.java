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
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.model.TrainingExamSourcePickMode;
import ru.staffly.training.model.TrainingQuestion;
import ru.staffly.training.model.TrainingQuestionGroup;
import ru.staffly.training.model.TrainingQuestionBlank;
import ru.staffly.training.repository.*;

import java.util.List;
import java.util.LinkedHashMap;
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
    private final TrainingExamSourceFolderRepository folderSources;
    private final TrainingExamSourceQuestionRepository questionSources;
    private final TrainingQuestionValidator validator;
    private final TrainingQuestionNestedPersistence nestedPersistence;
    private final TrainingPolicyService trainingPolicyService;
    private final TrainingActiveContainerValidator activeContainerValidator;

    @Override
    @Transactional(readOnly = true)
    public List<TrainingQuestionDto> listQuestions(Long restaurantId, Long userId, Long folderId, ru.staffly.training.model.TrainingQuestionGroup questionGroup, boolean includeInactive, String query) {
        requireReadableQuestionBankFolder(restaurantId, userId, folderId);
        return toDtos(questions.listForFolder(restaurantId, folderId, questionGroup, includeInactive, query));
    }

    @Override
    @Transactional
    public TrainingQuestionDto createQuestion(Long restaurantId, Long userId, CreateTrainingQuestionRequest request) {
        validator.validateQuestion(request.type(), request.title(), request.prompt(), request.options(), request.matchPairs(), request.blanks());

        var folder = requireManageableQuestionBankFolder(restaurantId, userId, request.folderId());
        activeContainerValidator.requireActiveChain(folder);
        assertQuestionDoesNotGrowActiveAllSource(
                restaurantId, folder.getId(), request.questionGroup());
        var entity = questions.save(TrainingQuestion.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .type(request.type())
                .questionGroup(request.questionGroup())
                .title(request.title().trim())
                .prompt(request.prompt().trim())
                .explanation(request.explanation())
                .sortOrder(request.sortOrder() == null
                        ? nextQuestionSortOrder(restaurantId, folder.getId(), request.questionGroup())
                        : normalizeSortOrder(request.sortOrder()))
                .active(true)
                .build());

        nestedPersistence.saveNested(entity, request.options(), request.matchPairs(), request.blanks());
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto updateQuestion(Long restaurantId, Long userId, Long questionId, UpdateTrainingQuestionRequest request) {
        validator.validateQuestion(request.type(), request.title(), request.prompt(), request.options(), request.matchPairs(), request.blanks());

        var entity = requireManageableQuestion(restaurantId, userId, questionId);
        if (entity.isActive()) {
            assertQuestionNotUsedInExamsForMutation(restaurantId, entity);
        }

        boolean wasActive = entity.isActive();
        var oldGroup = entity.getQuestionGroup();
        boolean willBeActive = request.active() == null ? wasActive : request.active();
        var currentFolder = entity.getFolder();
        boolean folderChanged = request.folderId() != null
                && !Objects.equals(request.folderId(), currentFolder.getId());
        var targetFolder = folderChanged
                ? requireManageableQuestionBankFolder(restaurantId, userId, request.folderId())
                : currentFolder;
        if (willBeActive) {
            activeContainerValidator.requireActiveChain(targetFolder);
        }
        var targetGroup = request.questionGroup();
        boolean questionGroupChanged = targetGroup != oldGroup;
        if (willBeActive && (!wasActive || folderChanged || questionGroupChanged)) {
            assertQuestionDoesNotGrowActiveAllSource(
                    restaurantId, targetFolder.getId(), targetGroup);
        }
        int targetSortOrder = request.sortOrder() != null
                ? normalizeSortOrder(request.sortOrder())
                : folderChanged || questionGroupChanged || (!wasActive && willBeActive)
                        ? nextQuestionSortOrder(restaurantId, targetFolder.getId(), targetGroup)
                        : entity.getSortOrder();

        entity.setTitle(request.title().trim());
        entity.setPrompt(request.prompt().trim());
        entity.setExplanation(request.explanation());
        entity.setType(request.type());
        entity.setQuestionGroup(targetGroup);
        entity.setFolder(targetFolder);
        entity.setSortOrder(targetSortOrder);
        entity.setActive(willBeActive);

        nestedPersistence.replaceNested(entity, request.options(), request.matchPairs(), request.blanks());
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto moveQuestion(Long restaurantId, Long userId, Long questionId, MoveTrainingQuestionRequest request) {
        var entity = requireManageableQuestion(restaurantId, userId, questionId);
        if (!entity.isActive()) {
            throw new BadRequestException("Скрытый вопрос нельзя перемещать.");
        }
        assertQuestionNotUsedInExamsForMutation(restaurantId, entity);

        var folder = requireManageableQuestionBankFolder(restaurantId, userId, request.folderId());
        activeContainerValidator.requireActiveChain(folder);
        if (!Objects.equals(entity.getFolder().getId(), folder.getId())) {
            assertQuestionDoesNotGrowActiveAllSource(
                    restaurantId, folder.getId(), entity.getQuestionGroup());
        }
        entity.setFolder(folder);
        entity.setSortOrder(request.sortOrder() == null
                ? nextQuestionSortOrder(restaurantId, folder.getId(), entity.getQuestionGroup())
                : normalizeSortOrder(request.sortOrder()));
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto hideQuestion(Long restaurantId, Long userId, Long questionId) {
        var entity = requireManageableQuestion(restaurantId, userId, questionId);
        assertQuestionNotUsedInActiveExamsForMutation(restaurantId, entity);
        entity.setActive(false);
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public TrainingQuestionDto restoreQuestion(Long restaurantId, Long userId, Long questionId) {
        var entity = requireManageableQuestion(restaurantId, userId, questionId);
        activeContainerValidator.requireActiveChain(entity.getFolder());
        if (!entity.isActive()) {
            assertQuestionDoesNotGrowActiveAllSource(
                    restaurantId, entity.getFolder().getId(), entity.getQuestionGroup());
            entity.setSortOrder(nextQuestionSortOrder(
                    restaurantId,
                    entity.getFolder().getId(),
                    entity.getQuestionGroup()
            ));
            entity.setActive(true);
        }
        return toDtos(List.of(entity)).get(0);
    }

    @Override
    @Transactional
    public void deleteQuestion(Long restaurantId, Long userId, Long questionId) {
        var entity = requireManageableQuestion(restaurantId, userId, questionId);
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

    private ru.staffly.training.model.TrainingFolder requireReadableQuestionBankFolder(Long restaurantId, Long userId, Long folderId) {
        var folder = folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.QUESTION_BANK) {
            throw new BadRequestException("Wrong folder type");
        }
        trainingPolicyService.assertCanAccessQuestionBankByVisibility(
                userId,
                restaurantId,
                folder.getVisibilityPositions().stream().map(position -> position.getId()).collect(Collectors.toSet())
        );
        return folder;
    }

    private ru.staffly.training.model.TrainingFolder requireManageableQuestionBankFolder(Long restaurantId, Long userId, Long folderId) {
        var folder = requireQuestionBankFolder(restaurantId, folderId);
        trainingPolicyService.assertCanManageQuestionBankByVisibility(
                userId,
                restaurantId,
                folder.getVisibilityPositions().stream().map(position -> position.getId()).collect(Collectors.toSet())
        );
        return folder;
    }

    private ru.staffly.training.model.TrainingFolder requireQuestionBankFolder(Long restaurantId, Long folderId) {
        var folder = folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.QUESTION_BANK) {
            throw new BadRequestException("Wrong folder type");
        }
        return folder;
    }

    private int nextQuestionSortOrder(Long restaurantId, Long folderId, ru.staffly.training.model.TrainingQuestionGroup questionGroup) {
        return java.util.Optional.ofNullable(
                questions.maxActiveSortOrderInFolderAndQuestionGroup(restaurantId, folderId, questionGroup)
        ).orElse(-1) + 1;
    }

    private int normalizeSortOrder(Integer value) {
        if (value == null) {
            return 0;
        }
        if (value < 0) {
            throw new BadRequestException("Порядок не может быть отрицательным");
        }
        return value;
    }

    /** Questions have no independent visibility; management authority is inherited from their folder. */
    private TrainingQuestion requireManageableQuestion(Long restaurantId, Long userId, Long questionId) {
        var question = questions.findByIdAndRestaurantIdWithFolderVisibility(questionId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Question not found"));
        trainingPolicyService.assertCanManageQuestionBankByVisibility(
                userId,
                restaurantId,
                question.getFolder().getVisibilityPositions().stream().map(position -> position.getId()).collect(Collectors.toSet())
        );
        return question;
    }

    private void assertQuestionNotUsedInExamsForMutation(Long restaurantId, TrainingQuestion question) {
        assertQuestionNotUsedInActiveExamsForMutation(restaurantId, question);
    }

    private void assertQuestionDoesNotGrowActiveAllSource(Long restaurantId,
                                                           Long folderId,
                                                           TrainingQuestionGroup questionGroup) {
        var usages = folderSources.findActiveExamUsagesByFolderAndPickModeAndExamMode(
                restaurantId,
                folderId,
                TrainingExamSourcePickMode.ALL,
                TrainingExamMode.valueOf(questionGroup.name())
        );
        if (usages.isEmpty()) {
            return;
        }
        var message = usages.size() == 1
                ? "Папка используется в активном тесте \"" + usages.get(0).getTitle()
                        + "\" в режиме «Все вопросы». Сначала измените источники теста."
                : "Папка используется в активных тестах в режиме «Все вопросы». Сначала измените источники тестов.";
        throw new ConflictException(message, Map.of("exams", usages));
    }

    private void assertQuestionNotUsedInActiveExamsForMutation(Long restaurantId, TrainingQuestion question) {
        var usagesByExamId = new LinkedHashMap<Long, ru.staffly.training.repository.projection.TrainingExamUsageProjection>();
        questionSources.findActiveExamUsagesByRestaurantIdAndQuestionId(restaurantId, question.getId())
                .forEach(usage -> usagesByExamId.put(usage.getId(), usage));
        folderSources.findActiveExamUsagesByRestaurantIdAndQuestionViaFolder(restaurantId, question.getId())
                .forEach(usage -> usagesByExamId.put(usage.getId(), usage));

        var usages = List.copyOf(usagesByExamId.values());
        if (usages.isEmpty()) {
            return;
        }

        var message = usages.size() == 1
                ? "Вопрос используется в активном тесте \"" + usages.get(0).getTitle()
                        + "\". Сначала уберите его из источников теста."
                : "Вопрос используется в нескольких активных тестах. Сначала уберите его из их источников.";
        throw new ConflictException(
                message,
                Map.of("exams", usages)
        );
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
