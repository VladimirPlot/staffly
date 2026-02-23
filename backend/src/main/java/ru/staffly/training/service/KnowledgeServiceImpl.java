package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.media.TrainingImageStorage;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.TrainingFolder;
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.model.TrainingKnowledgeItem;
import ru.staffly.training.repository.TrainingExamScopeRepository;
import ru.staffly.training.repository.TrainingFolderRepository;
import ru.staffly.training.repository.TrainingKnowledgeItemRepository;

import java.io.IOException;
import java.util.*;

@Service
@RequiredArgsConstructor
public class KnowledgeServiceImpl implements KnowledgeService {
    private static final long MAX_IMAGE_BYTES = 2L * 1024 * 1024;

    private final TrainingFolderRepository folders;
    private final TrainingKnowledgeItemRepository items;
    private final TrainingImageStorage storage;
    private final TrainingExamScopeRepository scopes;

    @Override
    public List<TrainingFolderDto> listFolders(Long restaurantId, TrainingFolderType type, boolean includeInactive) {
        var entities = includeInactive
                ? folders.findByRestaurantIdAndTypeOrderBySortOrderAscNameAsc(restaurantId, type)
                : folders.findByRestaurantIdAndTypeAndActiveTrueOrderBySortOrderAscNameAsc(restaurantId, type);
        return entities.stream().map(this::toDto).toList();
    }

    @Override
    public TrainingFolderDto createFolder(Long restaurantId, CreateTrainingFolderRequest request) {
        TrainingFolder parent = null;
        if (request.parentId() != null) {
            parent = folders.findByIdAndRestaurantId(request.parentId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
            if (parent.getType() != request.type()) throw new BadRequestException("Parent folder type mismatch");
        }
        var entity = TrainingFolder.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .parent(parent)
                .name(request.name())
                .description(request.description())
                .type(request.type())
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .active(true)
                .build();
        return toDto(folders.save(entity));
    }

    @Override
    public TrainingFolderDto updateFolder(Long restaurantId, Long folderId, UpdateTrainingFolderRequest request) {
        var entity = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        entity.setName(request.name());
        entity.setDescription(request.description());
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : request.sortOrder());
        return toDto(folders.save(entity));
    }

    @Override
    @Transactional
    public TrainingFolderDto hideFolder(Long restaurantId, Long folderId) {
        var root = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        setFolderTreeActive(restaurantId, root, false);
        return toDto(root);
    }

    @Override
    @Transactional
    public TrainingFolderDto restoreFolder(Long restaurantId, Long folderId) {
        var root = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        setFolderTreeActive(restaurantId, root, true);
        return toDto(root);
    }

    @Override
    @Transactional
    public void deleteFolder(Long restaurantId, Long folderId) {
        var root = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        if (root.isActive()) throw new ConflictException("Folder must be hidden before delete");

        var allFolderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        if (root.getType() == TrainingFolderType.QUESTION_BANK) {
            var usages = scopes.findExamUsagesByRestaurantIdAndFolderIds(restaurantId, allFolderIds);
            if (!usages.isEmpty()) {
                throw new ConflictException("Нельзя удалить папку: она используется в экзаменах. Уберите папку из области экзаменов и повторите.", Map.of("exams", usages));
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
    public List<TrainingKnowledgeItemDto> listKnowledgeItems(Long restaurantId, Long folderId, boolean includeInactive) {
        var list = includeInactive
                ? items.findByRestaurantIdAndFolderIdOrderBySortOrderAscTitleAsc(restaurantId, folderId)
                : items.findByRestaurantIdAndFolderIdAndActiveTrueOrderBySortOrderAscTitleAsc(restaurantId, folderId);
        return list.stream().map(this::toDto).toList();
    }

    @Override
    public TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, CreateTrainingKnowledgeItemRequest request) {
        var folder = loadFolder(restaurantId, request.folderId(), TrainingFolderType.KNOWLEDGE);
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
        if (request.folderId() != null && !request.folderId().equals(entity.getFolder().getId())) {
            entity.setFolder(loadFolder(restaurantId, request.folderId(), TrainingFolderType.KNOWLEDGE));
        }
        return toDto(items.save(entity));
    }

    @Override
    public TrainingKnowledgeItemDto hideKnowledgeItem(Long restaurantId, Long itemId) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        entity.setActive(false);
        return toDto(entity);
    }

    @Override
    public TrainingKnowledgeItemDto restoreKnowledgeItem(Long restaurantId, Long itemId) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        entity.setActive(true);
        return toDto(entity);
    }

    @Override
    @Transactional
    public void deleteKnowledgeItem(Long restaurantId, Long itemId) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        if (entity.isActive()) throw new ConflictException("Item must be hidden before delete");
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

    private void setFolderTreeActive(Long restaurantId, TrainingFolder root, boolean active) {
        var folderIds = collectFolderIds(restaurantId, root.getId(), root.getType());
        folders.updateActiveByRestaurantIdAndIdIn(restaurantId, folderIds, active);
        items.updateActiveByRestaurantIdAndFolderIdIn(restaurantId, folderIds, active);
        root.setActive(active);
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
        return new TrainingFolderDto(entity.getId(), entity.getRestaurant().getId(), entity.getParent() == null ? null : entity.getParent().getId(),
                entity.getName(), entity.getDescription(), entity.getType(), entity.getSortOrder(), entity.isActive());
    }

    private TrainingKnowledgeItemDto toDto(TrainingKnowledgeItem entity) {
        return new TrainingKnowledgeItemDto(entity.getId(), entity.getRestaurant().getId(), entity.getFolder().getId(), entity.getTitle(),
                entity.getDescription(), entity.getComposition(), entity.getAllergens(), entity.getImageUrl(), entity.getSortOrder(), entity.isActive());
    }
}
