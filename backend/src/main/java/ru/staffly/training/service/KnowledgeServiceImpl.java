package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import jakarta.persistence.EntityManager;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.media.TrainingImageStorage;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.security.SecurityService;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamSourceFolderRepository;
import ru.staffly.training.repository.TrainingExamRepository;
import ru.staffly.training.repository.TrainingFolderRepository;
import ru.staffly.training.repository.TrainingKnowledgeItemRepository;
import ru.staffly.training.repository.TrainingQuestionRepository;

import java.io.IOException;
import java.util.*;

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
    private final RestaurantMemberRepository members;
    private final PositionRepository positions;
    private final SecurityService securityService;

    @Transactional(readOnly = true)
    @Override
    public List<TrainingFolderDto> listFolders(Long restaurantId, Long userId, TrainingFolderType type, boolean includeInactive) {
        if (!securityService.hasAtLeastManager(userId, restaurantId)) {
            var member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                    .orElseThrow(() -> new ForbiddenException("Not a member"));
            if (member.getPosition() == null) {
                throw new ForbiddenException("Обратитесь к менеджеру или в поддержку.");
            }
            var entities = folders.listFoldersForStaff(restaurantId, type, member.getPosition().getId());
            return entities.stream().map(this::toDto).toList();
        }
        var entities = includeInactive
                ? folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, type)
                : folders.findByRestaurantIdAndTypeAndActiveTrueWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, type);
        return entities.stream().map(this::toDto).toList();
    }

    
    @Override
    public List<QuestionBankTreeNodeDto> getQuestionBankTree(Long restaurantId, TrainingExamMode mode, boolean includeInactive) {
        var foldersList = folders.findByRestaurantIdAndType(restaurantId, TrainingFolderType.QUESTION_BANK);
        var group = mode == TrainingExamMode.PRACTICE ? TrainingQuestionGroup.PRACTICE : TrainingQuestionGroup.CERTIFICATION;
        var counts = questions.countByFolderForMode(restaurantId, group, includeInactive).stream()
                .collect(java.util.stream.Collectors.toMap(x -> (Long) x[0], x -> (Long) x[1]));

        Map<Long, List<TrainingFolder>> childrenByParent = foldersList.stream()
                .collect(java.util.stream.Collectors.groupingBy(f -> f.getParent() == null ? 0L : f.getParent().getId()));

        java.util.function.Function<TrainingFolder, QuestionBankTreeNodeDto> mapper = new java.util.function.Function<>() {
            @Override
            public QuestionBankTreeNodeDto apply(TrainingFolder folder) {
                var children = childrenByParent.getOrDefault(folder.getId(), List.of()).stream()
                        .sorted(java.util.Comparator.comparing(TrainingFolder::getSortOrder).thenComparing(TrainingFolder::getName))
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
                .sorted(java.util.Comparator.comparing(TrainingFolder::getSortOrder).thenComparing(TrainingFolder::getName))
                .map(mapper)
                .toList();
    }
@Override
    public TrainingFolderDto createFolder(Long restaurantId, CreateTrainingFolderRequest request) {
        TrainingFolder parent = null;
        if (request.parentId() != null) {
            parent = folders.findByIdAndRestaurantIdWithVisibility(request.parentId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
            if (parent.getType() != request.type()) throw new BadRequestException("Parent folder type mismatch");
        }
        var visibilityPositions = resolveVisibilityPositionsForCreate(restaurantId, parent, request.visibilityPositionIds());
        var entity = TrainingFolder.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .parent(parent)
                .name(request.name())
                .description(request.description())
                .type(request.type())
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .active(true)
                .visibilityPositions(visibilityPositions)
                .build();
        return toDto(folders.save(entity));
    }

    @Override
    public TrainingFolderDto updateFolder(Long restaurantId, Long folderId, UpdateTrainingFolderRequest request) {
        var entity = folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : request.sortOrder());

        if (request.visibilityPositionIds() != null) {
            var parent = loadParentWithVisibility(restaurantId, entity.getParent());
            var targetVisibility = loadVisibilityPositions(restaurantId, request.visibilityPositionIds());
            validateChildVisibility(entity.getId(), parent, targetVisibility.stream().map(Position::getId).collect(java.util.stream.Collectors.toSet()));
            ensureNoDescendantConflicts(restaurantId, entity, targetVisibility.stream().map(Position::getId).collect(java.util.stream.Collectors.toSet()));
            entity.setVisibilityPositions(targetVisibility);
        }
        return toDto(folders.save(entity));
    }

    @Override
    @Transactional
    public TrainingFolderDto hideFolder(Long restaurantId, Long folderId) {
        var root = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        ensureKnowledgeFolderHasNoPracticeExams(restaurantId, root);
        setFolderTreeActive(restaurantId, root, false);
        return toDto(folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found")));
    }

    @Override
    @Transactional
    public TrainingFolderDto restoreFolder(Long restaurantId, Long folderId) {
        var root = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        setFolderTreeActive(restaurantId, root, true);
        return toDto(folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found")));
    }

    @Override
    @Transactional
    public void deleteFolder(Long restaurantId, Long folderId) {
        var root = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        if (root.isActive()) throw new ConflictException("Сначала скройте папку, затем удаляйте.");

        var allFolderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        if (root.getType() == TrainingFolderType.QUESTION_BANK) {
            var usages = folderSources.findExamUsagesByRestaurantIdAndFolderIds(restaurantId, allFolderIds);
            if (!usages.isEmpty()) {
                throw new ConflictException("Нельзя удалить папку: она используется в экзаменах. Уберите папку из области экзаменов и повторите.", Map.of("exams", usages));
            }
        }
        if (root.getType() == TrainingFolderType.KNOWLEDGE) {
            var usages = exams.findPracticeExamUsagesByKnowledgeFolderIds(restaurantId, allFolderIds);
            if (!usages.isEmpty()) {
                var titles = usages.stream().map(ExamUsageDto::title).distinct().toList();
                throw new ConflictException(
                        "Папка содержит учебные тесты: " + String.join(", ", titles) + ". Переместите/удалите тесты и повторите.",
                        Map.of("exams", usages)
                );
            }
        }
        var relatedItems = items.findByRestaurantIdAndFolderIdIn(restaurantId, allFolderIds);
        for (var item : relatedItems) {
            storage.deleteByPublicUrl(item.getImageUrl());
            storage.deleteItemFolder(item.getId());
        }
        folders.delete(root);
    }

    @Override
    public List<TrainingKnowledgeItemDto> listKnowledgeItems(Long restaurantId, Long userId, Long folderId, boolean includeInactive) {
        if (!securityService.hasAtLeastManager(userId, restaurantId)) {
            var member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                    .orElseThrow(() -> new ForbiddenException("Not a member"));
            if (member.getPosition() == null) {
                throw new ForbiddenException("Обратитесь к менеджеру или в поддержку.");
            }
            if (folderId == null) {
                var list = items.findByRestaurantIdAndFolderIsNullAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId);
                return list.stream().map(this::toDto).toList();
            }
            var folder = folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Folder not found"));
            var visibilityIds = folder.getVisibilityPositions().stream().map(Position::getId).collect(java.util.stream.Collectors.toSet());
            if (!visibilityIds.isEmpty() && !visibilityIds.contains(member.getPosition().getId())) {
                throw new ForbiddenException("Нет доступа к папке.");
            }
            var list = items.findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId, folderId);
            return list.stream().map(this::toDto).toList();
        }

        if (folderId == null) {
            var list = includeInactive
                    ? items.findByRestaurantIdAndFolderIsNullOrderBySortOrderAscTitleAsc(restaurantId)
                    : items.findByRestaurantIdAndFolderIsNullAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId);
            return list.stream().map(this::toDto).toList();
        }

        var list = includeInactive
                ? items.findByRestaurantIdAndFolderIdOrderBySortOrderAscTitleAsc(restaurantId, folderId)
                : items.findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId, folderId);
        return list.stream().map(this::toDto).toList();
    }

    @Override
    public TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, CreateTrainingKnowledgeItemRequest request) {
        TrainingFolder folder = null;
        if (request.folderId() != null) {
            folder = loadFolder(restaurantId, request.folderId(), TrainingFolderType.KNOWLEDGE);
        }
        var entity = TrainingKnowledgeItem.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .title(request.title())
                .description(request.description())
                .composition(request.composition())
                .allergens(request.allergens())
                .imageUrl(request.imageUrl())
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .active(true)
                .build();
        return toDto(items.save(entity));
    }

    @Override
    public TrainingKnowledgeItemDto updateKnowledgeItem(Long restaurantId, Long itemId, UpdateTrainingKnowledgeItemRequest request) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        entity.setTitle(request.title());
        entity.setDescription(request.description());
        entity.setComposition(request.composition());
        entity.setAllergens(request.allergens());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : request.sortOrder());
        var currentFolderId = entity.getFolder() == null ? null : entity.getFolder().getId();
        if (!java.util.Objects.equals(request.folderId(), currentFolderId)) {
            entity.setFolder(request.folderId() == null ? null : loadFolder(restaurantId, request.folderId(), TrainingFolderType.KNOWLEDGE));
        }
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto hideKnowledgeItem(Long restaurantId, Long itemId) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        entity.setActive(false);
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto restoreKnowledgeItem(Long restaurantId, Long itemId) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        entity.setActive(true);
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public void deleteKnowledgeItem(Long restaurantId, Long itemId) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        if (entity.isActive()) throw new ConflictException("Сначала скройте материал, затем удаляйте.");
        storage.deleteByPublicUrl(entity.getImageUrl());
        storage.deleteItemFolder(itemId);
        items.delete(entity);
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto uploadKnowledgeImage(Long restaurantId, Long itemId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new BadRequestException("Файл не выбран");
        if (file.getSize() > MAX_IMAGE_BYTES) throw new BadRequestException("Файл больше 2MB");
        validateImage(file);
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        storage.deleteByPublicUrl(entity.getImageUrl());
        entity.setImageUrl(storage.saveForItem(itemId, file));
        return toDto(entity);
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto deleteKnowledgeImage(Long restaurantId, Long itemId) throws IOException {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        storage.deleteByPublicUrl(entity.getImageUrl());
        entity.setImageUrl(null);
        return toDto(entity);
    }

    private void validateImage(MultipartFile file) throws IOException {
        String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!Set.of("image/jpeg", "image/png", "image/webp").contains(ct)) {
            throw new BadRequestException("Only JPEG, PNG or WEBP allowed");
        }
        byte[] bytes = file.getBytes();
        if (bytes.length < 12) throw new BadRequestException("Invalid image file");
        boolean jpeg = (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8;
        boolean png = (bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
        boolean webp = bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
        if (!jpeg && !png && !webp) throw new BadRequestException("Invalid image signature");
    }

    private void ensureKnowledgeFolderHasNoPracticeExams(Long restaurantId, TrainingFolder root) {
        if (root.getType() != TrainingFolderType.KNOWLEDGE) {
            return;
        }
        var allFolderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        var usages = exams.findPracticeExamUsagesByKnowledgeFolderIds(restaurantId, allFolderIds);
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

    private List<Long> collectFolderIds(Long restaurantId, Long rootId, TrainingFolderType type) {
        var allFolders = folders.findByRestaurantIdAndType(restaurantId, type);
        Map<Long, List<Long>> childrenByParent = allFolders.stream()
                .filter(f -> f.getParent() != null)
                .collect(java.util.stream.Collectors.groupingBy(f -> f.getParent().getId(),
                        java.util.stream.Collectors.mapping(TrainingFolder::getId, java.util.stream.Collectors.toList())));

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

    private TrainingFolder loadFolder(Long restaurantId, Long folderId, TrainingFolderType type) {
        var folder = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != type) throw new BadRequestException("Folder type mismatch");
        return folder;
    }

    private TrainingFolderDto toDto(TrainingFolder entity) {
        var visibilityPositionIds = entity.getVisibilityPositions().stream()
                .map(Position::getId)
                .sorted()
                .toList();
        return new TrainingFolderDto(entity.getId(), entity.getRestaurant().getId(), entity.getParent() == null ? null : entity.getParent().getId(),
                entity.getName(), entity.getDescription(), entity.getType(), entity.getSortOrder(), entity.isActive(), visibilityPositionIds);
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
            if (requestedVisibilityIds == null) {
                return new HashSet<>();
            }
            return loadVisibilityPositions(restaurantId, requestedVisibilityIds);
        }

        if (requestedVisibilityIds == null) {
            return new HashSet<>(parent.getVisibilityPositions());
        }

        var visibility = loadVisibilityPositions(restaurantId, requestedVisibilityIds);
        validateChildVisibility(null, parent, visibility.stream().map(Position::getId).collect(java.util.stream.Collectors.toSet()));
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
        boolean allInRestaurant = loaded.stream().allMatch(p -> p.getRestaurant().getId().equals(restaurantId));
        if (!allInRestaurant) {
            throw new BadRequestException("Некорректные должности в видимости.");
        }
        return new HashSet<>(loaded);
    }

    private Set<Long> normalizeIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new HashSet<>();
        }
        return ids.stream().filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
    }

    private void validateChildVisibility(Long folderId, TrainingFolder parent, Set<Long> childVisibilityIds) {
        if (parent == null) {
            return;
        }
        var parentVisibilityIds = parent.getVisibilityPositions().stream()
                .map(Position::getId)
                .collect(java.util.stream.Collectors.toSet());
        if (parentVisibilityIds.isEmpty()) {
            return;
        }
        if (childVisibilityIds.isEmpty()) {
            throw new BadRequestException("Дочерняя папка не может расширять видимость родителя.");
        }
        if (!parentVisibilityIds.containsAll(childVisibilityIds)) {
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
                .collect(java.util.stream.Collectors.toSet());

        var conflicts = new ArrayList<Map<String, Object>>();
        for (var descendant : descendants) {
            var descendantVisibilityIds = descendant.getVisibilityPositions().stream()
                    .map(Position::getId)
                    .collect(java.util.stream.Collectors.toSet());

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
        return new TrainingKnowledgeItemDto(entity.getId(), entity.getRestaurant().getId(), entity.getFolder() == null ? null : entity.getFolder().getId(), entity.getTitle(),
                entity.getDescription(), entity.getComposition(), entity.getAllergens(), entity.getImageUrl(), entity.getSortOrder(), entity.isActive());
    }
}
