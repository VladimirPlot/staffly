package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.media.TrainingImageStorage;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.TrainingFolderDto;
import ru.staffly.training.dto.TrainingKnowledgeItemDto;
import ru.staffly.training.model.TrainingFolder;
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.model.TrainingKnowledgeItem;
import ru.staffly.training.repository.TrainingFolderRepository;
import ru.staffly.training.repository.TrainingKnowledgeItemRepository;

import java.io.IOException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KnowledgeServiceImpl implements KnowledgeService {
    private static final long MAX_IMAGE_BYTES = 2L * 1024 * 1024;

    private final TrainingFolderRepository folders;
    private final TrainingKnowledgeItemRepository items;
    private final TrainingImageStorage storage;

    @Override
    public List<TrainingFolderDto> listFolders(Long restaurantId, TrainingFolderType type) {
        return folders.findByRestaurantIdAndTypeOrderBySortOrderAscNameAsc(restaurantId, type).stream().map(this::toDto).toList();
    }

    @Override
    public TrainingFolderDto createFolder(Long restaurantId, TrainingFolderDto dto) {
        TrainingFolder parent = null;
        if (dto.parentId() != null) {
            parent = folders.findByIdAndRestaurantId(dto.parentId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
            if (parent.getType() != dto.type()) throw new BadRequestException("Parent folder type mismatch");
        }
        var entity = TrainingFolder.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .parent(parent)
                .name(dto.name())
                .description(dto.description())
                .type(dto.type())
                .sortOrder(dto.sortOrder() == null ? 0 : dto.sortOrder())
                .active(dto.active() == null || dto.active())
                .build();
        return toDto(folders.save(entity));
    }

    @Override
    public TrainingFolderDto updateFolder(Long restaurantId, Long folderId, TrainingFolderDto dto) {
        var entity = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        entity.setName(dto.name());
        entity.setDescription(dto.description());
        entity.setSortOrder(dto.sortOrder() == null ? entity.getSortOrder() : dto.sortOrder());
        entity.setActive(dto.active() == null ? entity.isActive() : dto.active());
        return toDto(folders.save(entity));
    }

    @Override
    public void deleteFolder(Long restaurantId, Long folderId) {
        var entity = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
        folders.delete(entity);
    }

    @Override
    public List<TrainingKnowledgeItemDto> listKnowledgeItems(Long restaurantId, Long folderId) {
        return items.findByRestaurantIdAndFolderIdOrderBySortOrderAscTitleAsc(restaurantId, folderId).stream().map(this::toDto).toList();
    }

    @Override
    public TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, TrainingKnowledgeItemDto dto) {
        var folder = loadFolder(restaurantId, dto.folderId(), TrainingFolderType.KNOWLEDGE);
        var entity = TrainingKnowledgeItem.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .folder(folder)
                .title(dto.title())
                .description(dto.description())
                .composition(dto.composition())
                .allergens(dto.allergens())
                .imageUrl(dto.imageUrl())
                .sortOrder(dto.sortOrder() == null ? 0 : dto.sortOrder())
                .active(dto.active() == null || dto.active())
                .build();
        return toDto(items.save(entity));
    }

    @Override
    public TrainingKnowledgeItemDto updateKnowledgeItem(Long restaurantId, Long itemId, TrainingKnowledgeItemDto dto) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        entity.setTitle(dto.title());
        entity.setDescription(dto.description());
        entity.setComposition(dto.composition());
        entity.setAllergens(dto.allergens());
        entity.setSortOrder(dto.sortOrder() == null ? entity.getSortOrder() : dto.sortOrder());
        entity.setActive(dto.active() == null ? entity.isActive() : dto.active());
        if (dto.folderId() != null && !dto.folderId().equals(entity.getFolder().getId())) {
            entity.setFolder(loadFolder(restaurantId, dto.folderId(), TrainingFolderType.KNOWLEDGE));
        }
        return toDto(items.save(entity));
    }

    @Override
    @Transactional
    public void deleteKnowledgeItem(Long restaurantId, Long itemId) {
        var entity = items.findByIdAndRestaurantId(itemId, restaurantId).orElseThrow(() -> new NotFoundException("Knowledge item not found"));
        storage.deleteByPublicUrl(entity.getImageUrl());
        storage.deleteItemFolder(itemId);
        items.delete(entity);
    }

    @Override
    @Transactional
    public TrainingKnowledgeItemDto uploadKnowledgeImage(Long restaurantId, Long itemId, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) throw new BadRequestException("Файл не выбран");
        if (file.getSize() > MAX_IMAGE_BYTES) throw new BadRequestException("Файл больше 2MB");
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
