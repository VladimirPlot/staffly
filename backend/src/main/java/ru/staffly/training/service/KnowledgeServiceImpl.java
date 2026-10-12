package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.media.TrainingImageStorage;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.io.IOException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class KnowledgeServiceImpl implements KnowledgeService {
    private static final long MAX_IMAGE_BYTES = 2L * 1024 * 1024;

    private final TrainingFolderRepository folders;
    private final TrainingKnowledgeItemRepository items;
    private final TrainingImageStorage storage;
    private final TrainingExamSourceFolderRepository folderSources;
    private final TrainingExamSourceQuestionRepository questionSources;
    private final TrainingExamRepository exams;
    private final TrainingQuestionRepository questions;
    private final EntityManager entityManager;
    private final PositionRepository positions;
    private final TrainingPolicyService trainingPolicyService;
    private final CertificationFolderManagementService certificationFolderManagementService;
    private final ExamService examService;
    private final TrainingActiveContainerValidator activeContainerValidator;
    private final RestaurantLifecycleMutex lifecycleMutex;

    @Transactional(readOnly = true)
    @Override
    public List<TrainingFolderDto> listFolders(Long restaurantId, Long userId, TrainingFolderType type, boolean includeInactive) {
        trainingPolicyService.assertRestaurantUnlocked(userId, restaurantId);
        boolean canManageTraining = trainingPolicyService.canManageTraining(userId, restaurantId);
        var entities = includeInactive && canManageTraining
                ? folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, type)
                : folders.findByRestaurantIdAndTypeAndActiveTrueWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, type);

        Set<Long> manageableCertificationFolderIds = type == TrainingFolderType.CERTIFICATION
                ? certificationFolderManagementService.manageableFolderIds(restaurantId, userId)
                : Set.of();
        Set<Long> manageableQuestionBankFolderIds = type == TrainingFolderType.QUESTION_BANK
                ? manageableQuestionBankFolderIds(restaurantId, userId) : Set.of();
        return entities.stream()
                .filter(folder -> canAccessFolderByType(userId, restaurantId, folder))
                .map(folder -> toDto(folder, switch (type) {
                    case QUESTION_BANK -> manageableQuestionBankFolderIds.contains(folder.getId());
                    case CERTIFICATION -> manageableCertificationFolderIds.contains(folder.getId());
                    case KNOWLEDGE -> true;
                }))
                .toList();
    }

    @Override
    public List<QuestionBankTreeNodeDto> getQuestionBankTree(Long restaurantId, Long userId, TrainingExamMode mode, boolean includeInactive) {
        trainingPolicyService.assertRestaurantUnlocked(userId, restaurantId);
        var foldersList = folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, TrainingFolderType.QUESTION_BANK);
        var visibleFolders = foldersList.stream()
                .filter(folder -> includeInactive || folder.isActive())
                .filter(folder -> trainingPolicyService.canAccessQuestionBankByVisibility(
                        userId,
                        restaurantId,
                        folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
                ))
                .toList();
        var group = mode == TrainingExamMode.PRACTICE ? TrainingQuestionGroup.PRACTICE : TrainingQuestionGroup.CERTIFICATION;
        var counts = questions.countByFolderForMode(restaurantId, group, includeInactive).stream()
                .collect(Collectors.toMap(x -> (Long) x[0], x -> (Long) x[1]));

        Map<Long, List<TrainingFolder>> childrenByParent = visibleFolders.stream()
                .collect(Collectors.groupingBy(folder -> folder.getParent() == null ? 0L : folder.getParent().getId()));

        Function<TrainingFolder, QuestionBankTreeNodeDto> mapper = new Function<>() {
            @Override
            public QuestionBankTreeNodeDto apply(TrainingFolder folder) {
                var children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                        .sorted(Comparator.comparing(TrainingFolder::getSortOrder).thenComparing(TrainingFolder::getName))
                        .map(this)
                        .toList();
                return new QuestionBankTreeNodeDto(
                        folder.getId(),
                        folder.getParent() == null ? null : folder.getParent().getId(),
                        folder.getName(),
                        folder.isActive(),
                        folder.getSortOrder(),
                        counts.getOrDefault(folder.getId(), 0L),
                        children
                );
            }
        };

        return childrenByParent.getOrDefault(0L, List.of()).stream()
                .sorted(Comparator.comparing(TrainingFolder::getSortOrder).thenComparing(TrainingFolder::getName))
                .map(mapper)
                .toList();
    }

    @Override
    @Transactional
    public TrainingFolderDto createFolder(Long restaurantId, Long userId, CreateTrainingFolderRequest request) {
        lifecycleMutex.lock(restaurantId);
        trainingPolicyService.assertRestaurantUnlocked(userId, restaurantId);
        TrainingFolder parent = resolveParentFolder(restaurantId, userId, request.parentId(), request.type());
        requireActiveParent(parent);
        assertCanUseVisibilityPositions(userId, restaurantId, request.type(), request.visibilityPositionIds());
        var visibilityPositions = resolveVisibilityPositionsForCreate(restaurantId, parent, request.visibilityPositionIds());

        var entity = TrainingFolder.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .parent(parent)
                .name(request.name())
                .description(request.description())
                .type(request.type())
                .sortOrder(request.sortOrder() == null ? nextFolderSortOrder(restaurantId, request.type(), request.parentId()) : normalizeSortOrder(request.sortOrder()))
                .active(true)
                .visibilityPositions(visibilityPositions)
                .build();
        return toDto(folders.save(entity), request.type() != TrainingFolderType.CERTIFICATION
                || certificationFolderManagementService.manageableFolderIds(restaurantId, userId).contains(entity.getId()));
    }

    @Override
    @Transactional
    public TrainingFolderDto updateFolder(Long restaurantId, Long userId, Long folderId, UpdateTrainingFolderRequest request) {
        lifecycleMutex.lock(restaurantId);
        var entity = requireManageableFolder(restaurantId, userId, folderId);
        assertQuestionBankSubtreeManageable(restaurantId, userId, entity);
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : normalizeSortOrder(request.sortOrder()));

        if (request.visibilityPositionIds() != null) {
            assertCanUseVisibilityPositions(userId, restaurantId, entity.getType(), request.visibilityPositionIds());
            applyUpdatedVisibility(restaurantId, entity, request.visibilityPositionIds());
        }
        return toDto(folders.save(entity), true);
    }

    @Override
    @Transactional
    public TrainingFolderDto moveFolder(Long restaurantId, Long userId, Long folderId, MoveTrainingFolderRequest request) {
        lifecycleMutex.lock(restaurantId);
        var entity = requireManageableFolder(restaurantId, userId, folderId);
        assertQuestionBankSubtreeManageable(restaurantId, userId, entity);
        if (!entity.isActive()) {
            throw new BadRequestException("Скрытую папку нельзя перемещать.");
        }

        TrainingFolder parent = resolveParentFolder(restaurantId, userId, request.parentId(), entity.getType());
        requireActiveParent(parent);
        if (parent != null) {
            ensureNotMovingIntoSelfOrDescendant(restaurantId, entity.getId(), parent.getId(), entity.getType());
        }
        validateChildVisibility(parent, entity.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet()));

        entity.setParent(parent);
        entity.setSortOrder(request.sortOrder() == null
                ? nextFolderSortOrder(restaurantId, entity.getType(), request.parentId())
                : normalizeSortOrder(request.sortOrder()));
        return toDto(folders.save(entity), true);
    }

    @Override
    @Transactional
    public TrainingFolderDto hideFolder(Long restaurantId, Long userId, Long folderId) {
        lifecycleMutex.lock(restaurantId);
        var root = requireManageableFolder(restaurantId, userId, folderId);
        assertQuestionBankSubtreeManageable(restaurantId, userId, root);

        ensureKnowledgeFolderHasNoPracticeExams(restaurantId, root);
        if (root.getType() == TrainingFolderType.QUESTION_BANK) {
            assertQuestionBankTreeNotUsedByActiveExams(
                    restaurantId, collectFolderIds(restaurantId, root.getId(), root.getType()));
        }
        hideFolderTree(restaurantId, userId, root);

        return toDto(folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found")), true);
    }

    @Override
    @Transactional
    public TrainingFolderDto restoreFolder(Long restaurantId, Long userId, Long folderId) {
        lifecycleMutex.lock(restaurantId);
        var root = requireManageableFolder(restaurantId, userId, folderId);
        assertQuestionBankSubtreeManageable(restaurantId, userId, root);
        activeContainerValidator.requireActiveChain(root.getParent());

        if (!root.isActive()) restoreFolderTree(restaurantId, userId, root);
        return toDto(folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found")), true);
    }

    @Override
    @Transactional
    public void deleteFolder(Long restaurantId, Long userId, Long folderId) {
        lifecycleMutex.lock(restaurantId);
        var root = requireManageableFolder(restaurantId, userId, folderId);
        assertQuestionBankSubtreeManageable(restaurantId, userId, root);
        if (root.isActive()) {
            throw new ConflictException("Сначала скройте папку, затем удаляйте.");
        }

        var allFolderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        if (root.getType() == TrainingFolderType.CERTIFICATION) {
            for (var exam : exams.findCertificationByRestaurantIdAndFolderIdIn(restaurantId, allFolderIds)) {
                examService.deleteExam(restaurantId, userId, exam.getId());
            }
            deleteFoldersBottomUp(restaurantId, allFolderIds);
            return;
        }

        ensureFolderDeletionAllowed(restaurantId, root, allFolderIds);

        var relatedItems = items.findByRestaurantIdAndFolderIdIn(restaurantId, allFolderIds);
        for (var item : relatedItems) {
            storage.deleteByPublicUrl(item.getImageUrl());
            storage.deleteItemFolder(item.getId());
        }
        folders.delete(root);
    }

    private void deleteFoldersBottomUp(Long restaurantId, List<Long> folderIds) {
        var byId = folders.findAllById(folderIds).stream()
                .filter(folder -> Objects.equals(folder.getRestaurant().getId(), restaurantId))
                .collect(Collectors.toMap(TrainingFolder::getId, Function.identity()));
        var bottomUpIds = new ArrayList<>(folderIds);
        Collections.reverse(bottomUpIds);
        for (Long id : bottomUpIds) {
            var folder = byId.get(id);
            if (folder != null) {
                folders.delete(folder);
                folders.flush();
            }
        }
    }

    @Override
    @Transactional
    public void reorderObjects(Long restaurantId, Long userId, ReorderTrainingObjectsRequest request) {
        lifecycleMutex.lock(restaurantId);
        trainingPolicyService.assertRestaurantUnlocked(userId, restaurantId);
        TrainingFolder parent = request.folderId() == null ? null : requireManageableFolder(restaurantId, userId, request.folderId(), request.type());
        requireActiveParent(parent);

        if (new HashSet<>(request.orderedIds()).size() != request.orderedIds().size()) {
            throw new BadRequestException("Список сортировки содержит повторяющиеся ID");
        }

        switch (request.kind()) {
            case FOLDER -> reorderFolders(restaurantId, userId, request);
            case KNOWLEDGE_ITEM -> reorderKnowledgeItems(restaurantId, userId, request);
            case QUESTION -> reorderQuestions(restaurantId, userId, request);
            case PRACTICE_EXAM -> reorderPracticeExams(restaurantId, userId, request);
            case CERTIFICATION_EXAM -> reorderCertificationExams(restaurantId, userId, request);
        }
    }

    private void reorderFolders(Long restaurantId, Long userId, ReorderTrainingObjectsRequest request) {
        var actual = folders.findActiveInParent(restaurantId, request.type(), request.folderId());
        requireCompleteOrder(request.orderedIds(), actual.stream().map(TrainingFolder::getId).collect(Collectors.toSet()));
        var byId = actual.stream().collect(Collectors.toMap(TrainingFolder::getId, Function.identity()));
        request.orderedIds().forEach(id -> requireManageableFolder(restaurantId, userId, id, request.type()));
        applyOrder(request.orderedIds(), byId, TrainingFolder::setSortOrder);
    }

    private void reorderKnowledgeItems(Long restaurantId, Long userId, ReorderTrainingObjectsRequest request) {
        if (request.type() != TrainingFolderType.KNOWLEDGE) throw new BadRequestException("Карточки доступны только в базе знаний");
        var actual = request.folderId() == null
                ? items.findByRestaurantIdAndFolderIsNullAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId)
                : items.findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId, request.folderId());
        requireCompleteOrder(request.orderedIds(), actual.stream().map(TrainingKnowledgeItem::getId).collect(Collectors.toSet()));
        var byId = actual.stream().collect(Collectors.toMap(TrainingKnowledgeItem::getId, Function.identity()));
        request.orderedIds().forEach(id -> requireManageableKnowledgeItem(restaurantId, userId, id));
        applyOrder(request.orderedIds(), byId, TrainingKnowledgeItem::setSortOrder);
    }

    private void reorderQuestions(Long restaurantId, Long userId, ReorderTrainingObjectsRequest request) {
        if (request.type() != TrainingFolderType.QUESTION_BANK || request.folderId() == null) throw new BadRequestException("Вопросы доступны только в папках банка вопросов");
        if (request.questionGroup() == null) throw new BadRequestException("Для сортировки вопросов требуется группа вопросов");
        var actual = questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(
                restaurantId,
                request.folderId(),
                request.questionGroup()
        );
        requireCompleteOrder(request.orderedIds(), actual.stream().map(TrainingQuestion::getId).collect(Collectors.toSet()));
        var byId = actual.stream().collect(Collectors.toMap(TrainingQuestion::getId, Function.identity()));
        for (Long id : request.orderedIds()) {
            var question = questions.findByIdAndRestaurantIdWithFolderVisibility(id, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Question not found"));
            trainingPolicyService.assertCanManageQuestionBankByVisibility(
                    userId, restaurantId, visibilityPositionIds(question.getFolder()));
        }
        applyOrder(request.orderedIds(), byId, TrainingQuestion::setSortOrder);
    }

    private void reorderPracticeExams(Long restaurantId, Long userId, ReorderTrainingObjectsRequest request) {
        if (request.type() != TrainingFolderType.KNOWLEDGE || request.folderId() == null) throw new BadRequestException("Учебные тесты доступны только в папках базы знаний");
        var actual = exams.findActivePracticeInKnowledgeFolder(restaurantId, request.folderId());
        requireCompleteOrder(request.orderedIds(), actual.stream().map(TrainingExam::getId).collect(Collectors.toSet()));
        var byId = actual.stream().collect(Collectors.toMap(TrainingExam::getId, Function.identity()));
        request.orderedIds().forEach(id -> requireManageablePracticeExam(restaurantId, userId, id));
        applyOrder(request.orderedIds(), byId, TrainingExam::setSortOrder);
    }

    private void reorderCertificationExams(Long restaurantId, Long userId, ReorderTrainingObjectsRequest request) {
        if (request.type() != TrainingFolderType.CERTIFICATION) {
            throw new BadRequestException("Аттестационные тесты доступны только в разделе аттестаций");
        }
        var actual = request.folderId() == null
                ? exams.findActiveCertificationInRoot(restaurantId)
                : exams.findActiveCertificationInFolder(restaurantId, request.folderId());
        requireCompleteOrder(request.orderedIds(), actual.stream().map(TrainingExam::getId).collect(Collectors.toSet()));
        var byId = actual.stream().collect(Collectors.toMap(TrainingExam::getId, Function.identity()));
        request.orderedIds().forEach(id -> requireManageableCertificationExam(restaurantId, userId, id));
        applyOrder(request.orderedIds(), byId, TrainingExam::setSortOrder);
    }

    private void requireCompleteOrder(List<Long> requestedIds, Set<Long> actualIds) {
        if (!new HashSet<>(requestedIds).equals(actualIds)) {
            throw new BadRequestException("Список сортировки должен содержать все активные объекты выбранного типа");
        }
    }

    private <T> void applyOrder(List<Long> orderedIds, Map<Long, T> byId, java.util.function.ObjIntConsumer<T> setter) {
        for (int order = 0; order < orderedIds.size(); order++) setter.accept(byId.get(orderedIds.get(order)), order);
    }

    @Override
    public List<TrainingKnowledgeItemDto> listKnowledgeItems(Long restaurantId, Long userId, Long folderId, boolean includeInactive) {
        trainingPolicyService.assertRestaurantUnlocked(userId, restaurantId);
        boolean canManageTraining = trainingPolicyService.canManageTraining(userId, restaurantId);
        if (folderId != null) {
            requireAccessibleKnowledgeFolder(restaurantId, userId, folderId);
        }
        boolean includeInactiveItems = includeInactive && canManageTraining;
        return listKnowledgeItemsByFolder(restaurantId, folderId, includeInactiveItems);
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, Long userId, CreateTrainingKnowledgeItemRequest request) {
        lifecycleMutex.lock(restaurantId);
        trainingPolicyService.assertRestaurantUnlocked(userId, restaurantId);
        TrainingFolder folder = request.folderId() == null
                ? null
                : requireManageableKnowledgeFolder(restaurantId, userId, request.folderId());
        requireActiveParent(folder);

        var entity = TrainingKnowledgeItem.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .title(request.title())
                .description(request.description())
                .composition(request.composition())
                .allergens(request.allergens())
                .imageUrl(request.imageUrl())
                .sortOrder(request.sortOrder() == null
                        ? nextKnowledgeItemSortOrder(restaurantId, request.folderId())
                        : normalizeSortOrder(request.sortOrder()))
                .active(true)
                .build();
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto updateKnowledgeItem(Long restaurantId, Long userId, Long itemId, UpdateTrainingKnowledgeItemRequest request) {
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);

        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setComposition(request.composition());
        entity.setAllergens(request.allergens());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : normalizeSortOrder(request.sortOrder()));

        var currentFolderId = entity.getFolder() == null ? null : entity.getFolder().getId();
        if (!Objects.equals(request.folderId(), currentFolderId)) {
            var folder = request.folderId() == null
                    ? null
                    : requireManageableKnowledgeFolder(restaurantId, userId, request.folderId());
            requireActiveParent(folder);
            entity.setFolder(folder);
            entity.setHiddenByFolderId(null);
            if (request.sortOrder() == null) {
                entity.setSortOrder(nextKnowledgeItemSortOrder(restaurantId, request.folderId()));
            }
        }
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto moveKnowledgeItem(Long restaurantId, Long userId, Long itemId, MoveTrainingKnowledgeItemRequest request) {
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);
        if (!entity.isActive()) {
            throw new BadRequestException("Скрытую карточку нельзя перемещать.");
        }
        TrainingFolder folder = request.folderId() == null
                ? null
                : requireManageableKnowledgeFolder(restaurantId, userId, request.folderId());
        requireActiveParent(folder);
        entity.setFolder(folder);
        entity.setSortOrder(request.sortOrder() == null
                ? nextKnowledgeItemSortOrder(restaurantId, request.folderId())
                : normalizeSortOrder(request.sortOrder()));
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto hideKnowledgeItem(Long restaurantId, Long userId, Long itemId) {
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);
        entity.setActive(false);
        entity.setHiddenByFolderId(null);
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto restoreKnowledgeItem(Long restaurantId, Long userId, Long itemId) {
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);
        activeContainerValidator.requireActiveChain(entity.getFolder());
        if (!entity.isActive()) {
            var folderId = entity.getFolder() == null ? null : entity.getFolder().getId();
            entity.setSortOrder(nextKnowledgeItemSortOrder(restaurantId, folderId));
            entity.setActive(true);
            entity.setHiddenByFolderId(null);
        }
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public void deleteKnowledgeItem(Long restaurantId, Long userId, Long itemId) {
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);
        if (entity.isActive()) {
            throw new ConflictException("Сначала скройте материал, затем удаляйте.");
        }
        storage.deleteByPublicUrl(entity.getImageUrl());
        storage.deleteItemFolder(itemId);
        items.delete(entity);
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto uploadKnowledgeImage(Long restaurantId, Long userId, Long itemId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не выбран");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BadRequestException("Файл больше 2MB");
        }

        validateImage(file);
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);
        storage.deleteByPublicUrl(entity.getImageUrl());
        entity.setImageUrl(storage.saveForItem(itemId, file));
        return toDto(entity);
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto deleteKnowledgeImage(Long restaurantId, Long userId, Long itemId) throws IOException {
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);
        storage.deleteByPublicUrl(entity.getImageUrl());
        entity.setImageUrl(null);
        return toDto(entity);
    }

    private List<TrainingKnowledgeItemDto> listKnowledgeItemsByFolder(Long restaurantId, Long folderId, boolean includeInactive) {
        if (folderId == null) {
            var rootItems = includeInactive
                    ? items.findByRestaurantIdAndFolderIsNullOrderBySortOrderAscTitleAsc(restaurantId)
                    : items.findByRestaurantIdAndFolderIsNullAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId);
            return rootItems.stream().map(this::toDto).toList();
        }

        var folderItems = includeInactive
                ? items.findByRestaurantIdAndFolderIdOrderBySortOrderAscTitleAsc(restaurantId, folderId)
                : items.findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId, folderId);
        return folderItems.stream().map(this::toDto).toList();
    }

    private TrainingFolder resolveParentFolder(Long restaurantId, Long userId, Long parentId, TrainingFolderType expectedType) {
        if (parentId == null) {
            return null;
        }
        return requireManageableFolder(restaurantId, userId, parentId, expectedType);
    }

    private void requireActiveParent(TrainingFolder parent) {
        activeContainerValidator.requireActiveChain(parent);
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

    private int nextFolderSortOrder(Long restaurantId, TrainingFolderType type, Long parentId) {
        return Optional.ofNullable(folders.maxActiveSortOrderInParent(restaurantId, type, parentId)).orElse(-1) + 1;
    }

    private int nextKnowledgeItemSortOrder(Long restaurantId, Long folderId) {
        return Optional.ofNullable(items.maxActiveSortOrderInFolder(restaurantId, folderId)).orElse(-1) + 1;
    }

    private boolean canAccessFolderByType(Long userId, Long restaurantId, TrainingFolder folder) {
        var visibilityIds = folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
        return switch (folder.getType()) {
            case KNOWLEDGE -> trainingPolicyService.canAccessKnowledgeByVisibility(userId, restaurantId, visibilityIds);
            case QUESTION_BANK -> trainingPolicyService.canAccessQuestionBankByVisibility(userId, restaurantId, visibilityIds);
            case CERTIFICATION -> trainingPolicyService.canAccessCertificationByVisibility(userId, restaurantId, visibilityIds);
        };
    }

    private void assertCanUseVisibilityPositions(Long userId, Long restaurantId, TrainingFolderType type, List<Long> positionIds) {
        if (positionIds == null || positionIds.isEmpty()) {
            return;
        }
        var requested = new HashSet<>(positionIds);
        switch (type) {
            case KNOWLEDGE -> trainingPolicyService.assertCanUseKnowledgePositions(userId, restaurantId, requested);
            case QUESTION_BANK -> trainingPolicyService.assertCanUseQuestionBankPositions(userId, restaurantId, requested);
            case CERTIFICATION -> trainingPolicyService.assertCanUseCertificationPositions(userId, restaurantId, requested);
        }
    }

    private TrainingFolder requireAccessibleKnowledgeFolder(Long restaurantId, Long userId, Long folderId) {
        return requireFolderByPolicy(restaurantId, userId, folderId, TrainingFolderType.KNOWLEDGE);
    }

    private TrainingFolder requireManageableKnowledgeFolder(Long restaurantId, Long userId, Long folderId) {
        return requireFolderByPolicy(restaurantId, userId, folderId, TrainingFolderType.KNOWLEDGE);
    }

    private TrainingFolder requireManageableFolder(Long restaurantId, Long userId, Long folderId) {
        var folder = folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() == TrainingFolderType.QUESTION_BANK) {
            trainingPolicyService.assertCanManageQuestionBankByVisibility(userId, restaurantId, visibilityPositionIds(folder));
        } else {
            assertFolderAccessByType(userId, restaurantId, folder);
            if (folder.getType() == TrainingFolderType.CERTIFICATION) {
                certificationFolderManagementService.assertSubtreeManageable(restaurantId, userId, folderId);
            }
        }
        return folder;
    }

    private TrainingFolder requireManageableFolder(Long restaurantId, Long userId, Long folderId, TrainingFolderType expectedType) {
        var folder = requireManageableFolder(restaurantId, userId, folderId);
        if (folder.getType() != expectedType) {
            throw new BadRequestException("Parent folder type mismatch");
        }
        return folder;
    }

    private TrainingFolder requireFolderByPolicy(Long restaurantId, Long userId, Long folderId, TrainingFolderType expectedType) {
        var folder = folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != expectedType) {
            throw new BadRequestException("Folder type mismatch");
        }
        assertFolderAccessByType(userId, restaurantId, folder);
        return folder;
    }

    private void assertFolderAccessByType(Long userId, Long restaurantId, TrainingFolder folder) {
        var visibilityIds = visibilityPositionIds(folder);
        switch (folder.getType()) {
            case KNOWLEDGE -> trainingPolicyService.assertCanAccessKnowledgeByVisibility(userId, restaurantId, visibilityIds);
            case QUESTION_BANK -> trainingPolicyService.assertCanAccessQuestionBankByVisibility(userId, restaurantId, visibilityIds);
            case CERTIFICATION -> trainingPolicyService.assertCanAccessCertificationByVisibility(userId, restaurantId, visibilityIds);
        }
    }

    private Set<Long> manageableQuestionBankFolderIds(Long restaurantId, Long userId) {
        var all = folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, TrainingFolderType.QUESTION_BANK);
        var children = all.stream().filter(folder -> folder.getParent() != null)
                .collect(Collectors.groupingBy(folder -> folder.getParent().getId()));
        var memo = new HashMap<Long, Boolean>();
        for (var folder : all) questionBankSubtreeManageable(folder, children, memo, restaurantId, userId);
        return memo.entrySet().stream().filter(Map.Entry::getValue).map(Map.Entry::getKey).collect(Collectors.toSet());
    }

    private boolean questionBankSubtreeManageable(TrainingFolder folder, Map<Long, List<TrainingFolder>> children,
            Map<Long, Boolean> memo, Long restaurantId, Long userId) {
        if (memo.containsKey(folder.getId())) return memo.get(folder.getId());
        memo.put(folder.getId(), false);
        boolean allowed = trainingPolicyService.canManageQuestionBankByVisibility(userId, restaurantId, visibilityPositionIds(folder))
                && children.getOrDefault(folder.getId(), List.of()).stream()
                .allMatch(child -> questionBankSubtreeManageable(child, children, memo, restaurantId, userId));
        memo.put(folder.getId(), allowed);
        return allowed;
    }

    private void assertQuestionBankSubtreeManageable(Long restaurantId, Long userId, TrainingFolder root) {
        if (root.getType() != TrainingFolderType.QUESTION_BANK) return;
        var subtree = folders.findAllByRestaurantIdAndIdInWithVisibility(restaurantId,
                collectFolderIds(restaurantId, root.getId(), root.getType()));
        for (var folder : subtree) {
            trainingPolicyService.assertCanManageQuestionBankByVisibility(userId, restaurantId, visibilityPositionIds(folder));
        }
    }

    private Set<Long> visibilityPositionIds(TrainingFolder folder) {
        return folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
    }

    private TrainingKnowledgeItem requireManageableKnowledgeItem(Long restaurantId, Long userId, Long itemId) {
        lifecycleMutex.lock(restaurantId);
        trainingPolicyService.assertRestaurantUnlocked(userId, restaurantId);
        var item = items.findByIdAndRestaurantId(itemId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        if (item.getFolder() != null) {
            requireManageableKnowledgeFolder(restaurantId, userId, item.getFolder().getId());
        }
        return item;
    }

    private void applyUpdatedVisibility(Long restaurantId, TrainingFolder entity, List<Long> requestedVisibilityIds) {
        var parent = loadParentWithVisibility(restaurantId, entity.getParent());
        var targetVisibility = loadVisibilityPositions(restaurantId, requestedVisibilityIds);
        var targetVisibilityIds = targetVisibility.stream().map(Position::getId).collect(Collectors.toSet());

        validateChildVisibility(parent, targetVisibilityIds);
        ensureNoDescendantConflicts(restaurantId, entity, targetVisibilityIds);
        entity.setVisibilityPositions(targetVisibility);
    }

    private void ensureFolderDeletionAllowed(Long restaurantId, TrainingFolder root, List<Long> allFolderIds) {
        if (root.getType() == TrainingFolderType.QUESTION_BANK) {
            var usages = folderSources.findExamUsagesByRestaurantIdAndFolderIds(restaurantId, allFolderIds);
            var explicitUsages = questionSources.findExamUsagesByRestaurantIdAndQuestionFolderIds(
                    restaurantId, allFolderIds);
            if (!usages.isEmpty() || !explicitUsages.isEmpty()) {
                var allUsages = new ArrayList<Object>(usages);
                allUsages.addAll(explicitUsages);
                throw new ConflictException(
                        "Нельзя удалить папку: внутри неё есть источники тестов. Сначала уберите их из тестов.",
                        Map.of("exams", allUsages)
                );
            }
            return;
        }

        if (root.getType() == TrainingFolderType.KNOWLEDGE) {
            ensureKnowledgeFolderHasNoPracticeExams(restaurantId, allFolderIds);
            return;
        }

    }

    private void assertQuestionBankTreeNotUsedByActiveExams(Long restaurantId, List<Long> folderIds) {
        var folderUsages = folderSources.findActiveExamUsagesByRestaurantIdAndFolderIds(restaurantId, folderIds).stream()
                .filter(usage -> usage.getMode() != TrainingExamMode.CERTIFICATION).toList();
        var explicitUsages = questionSources.findActiveExamUsagesByRestaurantIdAndQuestionFolderIds(
                restaurantId, folderIds).stream().filter(usage -> usage.getMode() != TrainingExamMode.CERTIFICATION).toList();
        if (folderUsages.isEmpty() && explicitUsages.isEmpty()) {
            return;
        }
        var usagesByExamId = new LinkedHashMap<Long, ru.staffly.training.repository.projection.TrainingExamUsageProjection>();
        folderUsages.forEach(usage -> usagesByExamId.put(usage.getId(), usage));
        explicitUsages.forEach(usage -> usagesByExamId.put(usage.getId(), usage));
        throw new ConflictException(
                "Внутри скрываемой папки есть источник активного теста. Сначала уберите его из источников теста.",
                Map.of("exams", List.copyOf(usagesByExamId.values()))
        );
    }

    private void ensureNotMovingIntoSelfOrDescendant(Long restaurantId, Long folderId, Long candidateParentId, TrainingFolderType type) {
        if (Objects.equals(folderId, candidateParentId)) {
            throw new BadRequestException("Нельзя переместить папку в саму себя");
        }
        if (collectFolderIds(restaurantId, folderId, type).contains(candidateParentId)) {
            throw new BadRequestException("Нельзя переместить папку в свою подпапку");
        }
    }

    private TrainingExam requireManageablePracticeExam(Long restaurantId, Long userId, Long examId) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        if (exam.getMode() != TrainingExamMode.PRACTICE) {
            throw new BadRequestException("Операция доступна только для учебного теста.");
        }
        trainingPolicyService.assertCanAccessExamTargetByVisibility(
                userId,
                restaurantId,
                exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
        );
        if (exam.getFolder() != null) {
            requireAccessibleKnowledgeFolder(restaurantId, userId, exam.getFolder().getId());
        }
        return exam;
    }

    private TrainingExam requireManageableCertificationExam(Long restaurantId, Long userId, Long examId) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Операция доступна только для аттестационного теста.");
        }
        trainingPolicyService.assertCanManageCertificationTargets(
                userId,
                restaurantId,
                exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
        );
        if (exam.getFolder() != null) {
            certificationFolderManagementService.assertSubtreeManageable(
                    restaurantId, userId, exam.getFolder().getId());
        }
        return exam;
    }

    private void validateImage(MultipartFile file) throws IOException {
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!Set.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new BadRequestException("Only JPEG, PNG or WEBP allowed");
        }

        byte[] bytes = file.getBytes();
        if (bytes.length < 12) {
            throw new BadRequestException("Invalid image file");
        }

        boolean jpeg = (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8;
        boolean png = (bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
        boolean webp = bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
        if (!jpeg && !png && !webp) {
            throw new BadRequestException("Invalid image signature");
        }
    }

    private void ensureKnowledgeFolderHasNoPracticeExams(Long restaurantId, TrainingFolder root) {
        if (root.getType() != TrainingFolderType.KNOWLEDGE) {
            return;
        }
        var allFolderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        ensureKnowledgeFolderHasNoPracticeExams(restaurantId, allFolderIds);
    }

    private void ensureKnowledgeFolderHasNoPracticeExams(Long restaurantId, List<Long> folderIds) {
        var usages = exams.findPracticeExamUsagesByKnowledgeFolderIds(restaurantId, folderIds);
        if (usages.isEmpty()) {
            return;
        }

        var titles = usages.stream().map(ExamUsageDto::title).distinct().toList();
        throw new ConflictException(
                "Папка содержит учебные тесты: " + String.join(", ", titles) + ". Переместите/удалите тесты и повторите.",
                Map.of("exams", usages)
        );
    }

    private boolean inheritsHide(boolean active, Long marker, Long previousOwner) {
        return active || previousOwner != null && Objects.equals(marker, previousOwner);
    }

    private void hideFolderTree(Long restaurantId, Long userId, TrainingFolder root) {
        var ids = collectFolderIds(restaurantId, root.getId(), root.getType());
        var previousOwner = root.getHiddenByFolderId();
        if (root.getType() == TrainingFolderType.CERTIFICATION) {
            for (var exam : exams.findCertificationByRestaurantIdAndFolderIdIn(restaurantId, ids)) {
                if (inheritsHide(exam.isActive(), exam.getHiddenByFolderId(), previousOwner)) {
                    if (exam.isActive()) examService.hideExam(restaurantId, userId, exam.getId());
                    exam.setHiddenByFolderId(root.getId());
                }
            }
        } else if (root.getType() == TrainingFolderType.KNOWLEDGE) {
            for (var item : items.findByRestaurantIdAndFolderIdIn(restaurantId, ids)) {
                if (inheritsHide(item.isActive(), item.getHiddenByFolderId(), previousOwner)) {
                    item.setActive(false);
                    item.setHiddenByFolderId(root.getId());
                }
            }
        } else {
            for (var question : questions.findByRestaurantIdAndFolderIdIn(restaurantId, ids)) {
                if (inheritsHide(question.isActive(), question.getHiddenByFolderId(), previousOwner)) {
                    question.setActive(false);
                    question.setHiddenByFolderId(root.getId());
                }
            }
        }
        var tree = folders.findAllByRestaurantIdAndIdInWithVisibility(restaurantId, ids);
        for (var folder : tree) {
            if (!Objects.equals(folder.getId(), root.getId())
                    && inheritsHide(folder.isActive(), folder.getHiddenByFolderId(), previousOwner)) {
                folder.setActive(false);
                folder.setHiddenByFolderId(root.getId());
            }
        }
        root.setActive(false);
        root.setHiddenByFolderId(null);
        entityManager.flush();
    }

    private void restoreFolderTree(Long restaurantId, Long userId, TrainingFolder root) {
        var ids = collectFolderIds(restaurantId, root.getId(), root.getType());
        var byId = folders.findAllByRestaurantIdAndIdInWithVisibility(restaurantId, ids).stream()
                .collect(Collectors.toMap(TrainingFolder::getId, Function.identity()));
        byId.put(root.getId(), root);
        // BFS order activates parents first. Independently hidden branches stay closed.
        for (var id : ids) {
            var folder = byId.get(id);
            if (folder != null && (Objects.equals(id, root.getId()) || Objects.equals(folder.getHiddenByFolderId(), root.getId()))
                    && (folder.getParent() == null || folder.getParent().isActive())) {
                folder.setSortOrder(nextFolderSortOrder(restaurantId, root.getType(), folder.getParent() == null ? null : folder.getParent().getId()));
                folder.setHiddenByFolderId(null);
                folder.setActive(true);
                folders.save(folder);
                folders.flush();
            }
        }
        if (root.getType() == TrainingFolderType.CERTIFICATION) {
            for (var exam : exams.findCertificationByRestaurantIdAndFolderIdIn(restaurantId, ids)) {
                if (Objects.equals(exam.getHiddenByFolderId(), root.getId()) && exam.getFolder().isActive()) {
                    examService.restoreExam(restaurantId, userId, exam.getId());
                }
            }
        } else if (root.getType() == TrainingFolderType.KNOWLEDGE) {
            for (var item : items.findByRestaurantIdAndFolderIdIn(restaurantId, ids)) {
                if (Objects.equals(item.getHiddenByFolderId(), root.getId()) && item.getFolder().isActive()) {
                    item.setSortOrder(nextKnowledgeItemSortOrder(restaurantId, item.getFolder().getId()));
                    item.setHiddenByFolderId(null);
                    item.setActive(true);
                }
            }
        } else {
            for (var question : questions.findByRestaurantIdAndFolderIdIn(restaurantId, ids)) {
                if (Objects.equals(question.getHiddenByFolderId(), root.getId()) && question.getFolder().isActive()) {
                    question.setHiddenByFolderId(null);
                    question.setActive(true);
                }
            }
        }
        entityManager.flush();
    }

    private List<Long> collectFolderIds(Long restaurantId, Long rootId, TrainingFolderType type) {
        var allFolders = folders.findByRestaurantIdAndType(restaurantId, type);
        Map<Long, List<Long>> childrenByParent = allFolders.stream()
                .filter(folder -> folder.getParent() != null)
                .collect(Collectors.groupingBy(
                        folder -> folder.getParent().getId(),
                        Collectors.mapping(TrainingFolder::getId, Collectors.toList())
                ));

        var result = new ArrayList<Long>();
        var queue = new ArrayDeque<Long>();
        queue.add(rootId);
        while (!queue.isEmpty()) {
            var id = queue.removeFirst();
            result.add(id);
            queue.addAll(childrenByParent.getOrDefault(id, List.of()));
        }
        return result;
    }

    private TrainingFolderDto toDto(TrainingFolder entity, boolean manageable) {
        var visibilityPositionIds = entity.getVisibilityPositions().stream().map(Position::getId).sorted().toList();
        return new TrainingFolderDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getParent() == null ? null : entity.getParent().getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getType(),
                entity.getSortOrder(),
                entity.isActive(),
                visibilityPositionIds,
                manageable
        );
    }

    private TrainingFolder loadParentWithVisibility(Long restaurantId, TrainingFolder parent) {
        if (parent == null) {
            return null;
        }
        return folders.findByIdAndRestaurantIdWithVisibility(parent.getId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
    }

    private Set<Position> resolveVisibilityPositionsForCreate(Long restaurantId, TrainingFolder parent, List<Long> requestedVisibilityIds) {
        if (parent == null) {
            return requestedVisibilityIds == null ? new HashSet<>() : loadVisibilityPositions(restaurantId, requestedVisibilityIds);
        }

        if (requestedVisibilityIds == null) {
            return new HashSet<>(parent.getVisibilityPositions());
        }

        var visibility = loadVisibilityPositions(restaurantId, requestedVisibilityIds);
        validateChildVisibility(parent, visibility.stream().map(Position::getId).collect(Collectors.toSet()));
        return visibility;
    }

    private Set<Position> loadVisibilityPositions(Long restaurantId, List<Long> requestedVisibilityIds) {
        var normalizedIds = normalizeIds(requestedVisibilityIds);
        if (normalizedIds.isEmpty()) {
            return new HashSet<>();
        }

        var loaded = positions.findAllById(normalizedIds);
        if (loaded.size() != normalizedIds.size()) {
            throw new BadRequestException("Некорректные должности в видимости.");
        }
        boolean allInRestaurant = loaded.stream().allMatch(position -> position.getRestaurant().getId().equals(restaurantId));
        if (!allInRestaurant) {
            throw new BadRequestException("Некорректные должности в видимости.");
        }

        return new HashSet<>(loaded);
    }

    private Set<Long> normalizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new HashSet<>();
        }
        return ids.stream().filter(Objects::nonNull).collect(Collectors.toSet());
    }

    private void validateChildVisibility(TrainingFolder parent, Set<Long> childVisibilityIds) {
        if (parent == null) {
            return;
        }

        var parentVisibilityIds = parent.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
        if (parentVisibilityIds.isEmpty()) {
            return;
        }

        if (childVisibilityIds.isEmpty() || !parentVisibilityIds.containsAll(childVisibilityIds)) {
            throw new BadRequestException("Дочерняя папка не может расширять видимость родителя.");
        }
    }

    private void ensureNoDescendantConflicts(Long restaurantId, TrainingFolder folder, Set<Long> newVisibilityIds) {
        if (newVisibilityIds.isEmpty()) {
            return;
        }

        var allFolderIds = collectFolderIds(restaurantId, folder.getId(), folder.getType());
        var descendantIds = allFolderIds.stream().filter(id -> !id.equals(folder.getId())).toList();
        if (descendantIds.isEmpty()) {
            return;
        }

        var descendants = folders.findAllByRestaurantIdAndIdInWithVisibility(restaurantId, descendantIds);
        var allRestaurantPositionIds = positions.findByRestaurantId(restaurantId).stream()
                .map(Position::getId)
                .collect(Collectors.toSet());

        var conflicts = new ArrayList<Map<String, Object>>();
        for (var descendant : descendants) {
            var descendantVisibilityIds = descendant.getVisibilityPositions().stream()
                    .map(Position::getId)
                    .collect(Collectors.toSet());

            Set<Long> offending = new HashSet<>();
            if (descendantVisibilityIds.isEmpty()) {
                offending.addAll(allRestaurantPositionIds);
                offending.removeAll(newVisibilityIds);
            } else {
                offending.addAll(descendantVisibilityIds);
                offending.removeAll(newVisibilityIds);
            }

            if (!offending.isEmpty()) {
                conflicts.add(Map.of(
                        "folderId", descendant.getId(),
                        "folderName", descendant.getName(),
                        "offendingPositionIds", offending.stream().sorted().toList()
                ));
            }
        }

        if (!conflicts.isEmpty()) {
            throw new ConflictException(
                    "Нельзя изменить видимость: есть дочерние папки с конфликтующими должностями.",
                    Map.of("conflicts", conflicts)
            );
        }
    }

    private TrainingKnowledgeItemDto toDto(TrainingKnowledgeItem entity) {
        return new TrainingKnowledgeItemDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getFolder() == null ? null : entity.getFolder().getId(),
                entity.getTitle(),
                entity.getDescription(),
                entity.getComposition(),
                entity.getAllergens(),
                entity.getImageUrl(),
                entity.getSortOrder(),
                entity.isActive()
        );
    }
}
