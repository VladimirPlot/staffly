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
    private final TrainingExamRepository exams;
    private final TrainingQuestionRepository questions;
    private final EntityManager entityManager;
    private final PositionRepository positions;
    private final TrainingPolicyService trainingPolicyService;
    private final ExamService examService;

    @Transactional(readOnly = true)
    @Override
    public List<TrainingFolderDto> listFolders(Long restaurantId, Long userId, TrainingFolderType type, boolean includeInactive) {
        boolean canManageTraining = trainingPolicyService.canManageTraining(userId, restaurantId);
        var entities = includeInactive && canManageTraining
                ? folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, type)
                : folders.findByRestaurantIdAndTypeAndActiveTrueWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, type);

        return entities.stream()
                .filter(folder -> canAccessFolderByType(userId, restaurantId, folder))
                .map(this::toDto)
                .toList();
    }

    @Override
    public List<QuestionBankTreeNodeDto> getQuestionBankTree(Long restaurantId, Long userId, TrainingExamMode mode, boolean includeInactive) {
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
    public TrainingFolderDto createFolder(Long restaurantId, Long userId, CreateTrainingFolderRequest request) {
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
        return toDto(folders.save(entity));
    }

    @Override
    public TrainingFolderDto updateFolder(Long restaurantId, Long userId, Long folderId, UpdateTrainingFolderRequest request) {
        var entity = requireManageableFolder(restaurantId, userId, folderId);
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : normalizeSortOrder(request.sortOrder()));

        if (request.visibilityPositionIds() != null) {
            assertCanUseVisibilityPositions(userId, restaurantId, entity.getType(), request.visibilityPositionIds());
            applyUpdatedVisibility(restaurantId, entity, request.visibilityPositionIds());
        }
        return toDto(folders.save(entity));
    }

    @Override
    @Transactional
    public TrainingFolderDto moveFolder(Long restaurantId, Long userId, Long folderId, MoveTrainingFolderRequest request) {
        var entity = requireManageableFolder(restaurantId, userId, folderId);
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
        return toDto(folders.save(entity));
    }

    @Override
    @Transactional
    public TrainingFolderDto hideFolder(Long restaurantId, Long userId, Long folderId) {
        var root = requireManageableFolder(restaurantId, userId, folderId);

        ensureKnowledgeFolderHasNoPracticeExams(restaurantId, root);
        if (root.getType() == TrainingFolderType.CERTIFICATION) {
            var folderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
            for (var exam : exams.findCertificationByRestaurantIdAndFolderIdIn(restaurantId, folderIds)) {
                examService.hideExam(restaurantId, userId, exam.getId());
            }
            setCertificationFoldersActiveInHierarchy(restaurantId, folderIds, false);
        } else {
            setFolderTreeActive(restaurantId, root, false);
        }

        return toDto(folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found")));
    }

    @Override
    @Transactional
    public TrainingFolderDto restoreFolder(Long restaurantId, Long userId, Long folderId) {
        var root = requireManageableFolder(restaurantId, userId, folderId);

        if (root.getType() == TrainingFolderType.CERTIFICATION) {
            var folderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
            prepareFolderTreeRestore(restaurantId, root);
            setCertificationFoldersActiveInHierarchy(restaurantId, folderIds, true);
            for (var exam : exams.findCertificationByRestaurantIdAndFolderIdIn(restaurantId, folderIds)) {
                examService.restoreExam(restaurantId, userId, exam.getId());
            }
        } else {
            prepareFolderTreeRestore(restaurantId, root);
            setFolderTreeActive(restaurantId, root, true);
        }
        return toDto(folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found")));
    }

    @Override
    @Transactional
    public void deleteFolder(Long restaurantId, Long userId, Long folderId) {
        var root = requireManageableFolder(restaurantId, userId, folderId);
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

    private void setCertificationFoldersActiveInHierarchy(Long restaurantId, List<Long> folderIds, boolean active) {
        var byId = folders.findAllById(folderIds).stream()
                .filter(folder -> Objects.equals(folder.getRestaurant().getId(), restaurantId))
                .collect(Collectors.toMap(TrainingFolder::getId, Function.identity()));
        var orderedIds = active ? folderIds : new ArrayList<>(folderIds);
        if (!active) {
            Collections.reverse(orderedIds);
        }
        for (Long id : orderedIds) {
            var folder = byId.get(id);
            if (folder != null) {
                folder.setActive(active);
                folders.save(folder);
                folders.flush();
            }
        }
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
            assertFolderAccessByType(userId, restaurantId, question.getFolder());
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
        boolean canManageTraining = trainingPolicyService.canManageTraining(userId, restaurantId);
        if (folderId != null) {
            requireAccessibleKnowledgeFolder(restaurantId, userId, folderId);
        }
        boolean includeInactiveItems = includeInactive && canManageTraining;
        return listKnowledgeItemsByFolder(restaurantId, folderId, includeInactiveItems);
    }

    @Override
    public TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, Long userId, CreateTrainingKnowledgeItemRequest request) {
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
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto restoreKnowledgeItem(Long restaurantId, Long userId, Long itemId) {
        var entity = requireManageableKnowledgeItem(restaurantId, userId, itemId);
        if (!entity.isActive()) {
            var folderId = entity.getFolder() == null ? null : entity.getFolder().getId();
            entity.setSortOrder(nextKnowledgeItemSortOrder(restaurantId, folderId));
            entity.setActive(true);
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
        if (parent != null && !parent.isActive()) {
            throw new BadRequestException("Нельзя выбрать скрытую папку.");
        }
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
        assertFolderAccessByType(userId, restaurantId, folder);
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
        var visibilityIds = folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
        switch (folder.getType()) {
            case KNOWLEDGE -> trainingPolicyService.assertCanAccessKnowledgeByVisibility(userId, restaurantId, visibilityIds);
            case QUESTION_BANK -> trainingPolicyService.assertCanAccessQuestionBankByVisibility(userId, restaurantId, visibilityIds);
            case CERTIFICATION -> trainingPolicyService.assertCanAccessCertificationByVisibility(userId, restaurantId, visibilityIds);
        }
    }

    private TrainingKnowledgeItem requireManageableKnowledgeItem(Long restaurantId, Long userId, Long itemId) {
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
            if (!usages.isEmpty()) {
                throw new ConflictException(
                        "Нельзя удалить папку: она используется в экзаменах. Уберите папку из области экзаменов и повторите.",
                        Map.of("exams", usages)
                );
            }
            return;
        }

        if (root.getType() == TrainingFolderType.KNOWLEDGE) {
            ensureKnowledgeFolderHasNoPracticeExams(restaurantId, allFolderIds);
            return;
        }

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

    private void setFolderTreeActive(Long restaurantId, TrainingFolder root, boolean active) {
        var folderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        folders.updateActiveByRestaurantIdAndIdIn(restaurantId, folderIds, active);
        items.updateActiveByRestaurantIdAndFolderIdIn(restaurantId, folderIds, active);
        entityManager.flush();
        entityManager.clear();
    }

    private void prepareFolderTreeRestore(Long restaurantId, TrainingFolder root) {
        var folderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        var folderIdSet = new HashSet<>(folderIds);
        var treeFolders = folders.findByRestaurantIdAndType(restaurantId, root.getType()).stream()
                .filter(folder -> folderIdSet.contains(folder.getId()) && !folder.isActive())
                .sorted(Comparator.comparing(TrainingFolder::getSortOrder)
                        .thenComparing(TrainingFolder::getName)
                        .thenComparing(TrainingFolder::getId))
                .collect(Collectors.groupingBy(
                        folder -> folder.getParent() == null ? 0L : folder.getParent().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        for (var entry : treeFolders.entrySet()) {
            Long parentId = entry.getKey() == 0L ? null : entry.getKey();
            int nextOrder = nextFolderSortOrder(restaurantId, root.getType(), parentId);
            for (var folder : entry.getValue()) {
                folder.setSortOrder(nextOrder++);
            }
        }

        var hiddenItemsByFolder = items.findByRestaurantIdAndFolderIdIn(restaurantId, folderIds).stream()
                .filter(item -> !item.isActive())
                .sorted(Comparator.comparing(TrainingKnowledgeItem::getSortOrder)
                        .thenComparing(TrainingKnowledgeItem::getTitle)
                        .thenComparing(TrainingKnowledgeItem::getId))
                .collect(Collectors.groupingBy(
                        item -> item.getFolder().getId(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        for (var entry : hiddenItemsByFolder.entrySet()) {
            int nextOrder = nextKnowledgeItemSortOrder(restaurantId, entry.getKey());
            for (var item : entry.getValue()) {
                item.setSortOrder(nextOrder++);
            }
        }
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

    private TrainingFolderDto toDto(TrainingFolder entity) {
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
                visibilityPositionIds
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
