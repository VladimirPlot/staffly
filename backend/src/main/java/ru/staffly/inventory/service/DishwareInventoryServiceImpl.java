package ru.staffly.inventory.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.inventory.dto.*;
import ru.staffly.inventory.mapper.DishwareInventoryMapper;
import ru.staffly.inventory.model.DishwareInventory;
import ru.staffly.inventory.model.DishwareInventoryFolder;
import ru.staffly.inventory.model.DishwareInventoryItem;
import ru.staffly.inventory.model.DishwareInventoryStatus;
import ru.staffly.inventory.repository.DishwareInventoryFolderRepository;
import ru.staffly.inventory.repository.DishwareInventoryItemRepository;
import ru.staffly.inventory.repository.DishwareInventoryRepository;
import ru.staffly.media.DishwareInventoryImageStorage;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DishwareInventoryServiceImpl implements DishwareInventoryService {

    private static final long MAX_IMAGE_BYTES = 2 * 1024 * 1024;
    private static final DateTimeFormatter TITLE_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd.MM.yyyy");

    private final DishwareInventoryRepository inventories;
    private final DishwareInventoryFolderRepository folders;
    private final DishwareInventoryItemRepository items;
    private final RestaurantRepository restaurants;
    private final DishwareInventoryMapper mapper;
    private final SecurityService security;
    private final DishwareInventoryImageStorage storage;

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DishwareInventorySummaryDto> list(Long restaurantId, Long currentUserId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Set<Long> effectivelyTrashedFolderIds = effectivelyTrashedFolderIds(restaurantId);
        return inventories.findByRestaurantIdAndTrashedAtIsNullOrderByInventoryDateDescUpdatedAtDesc(restaurantId).stream()
                .filter(inventory -> !isInTrashedFolder(inventory, effectivelyTrashedFolderIds))
                .map(mapper::toSummaryDto)
                .toList();
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DishwareInventorySummaryDto> listTrash(Long restaurantId, Long currentUserId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Set<Long> effectivelyTrashedFolderIds = effectivelyTrashedFolderIds(restaurantId);
        return inventories.findByRestaurantIdOrderByInventoryDateDescUpdatedAtDesc(restaurantId).stream()
                .filter(inventory -> inventory.getTrashedAt() != null || isInTrashedFolder(inventory, effectivelyTrashedFolderIds))
                .map(mapper::toSummaryDto)
                .toList();
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<DishwareInventoryFolderDto> listFolders(Long restaurantId, Long currentUserId, boolean includeTrashed) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Set<Long> effectivelyTrashedFolderIds = effectivelyTrashedFolderIds(restaurantId);
        return folders.findByRestaurantIdOrderBySortOrderAscNameAsc(restaurantId).stream()
                .filter(folder -> includeTrashed || !effectivelyTrashedFolderIds.contains(folder.getId()))
                .map(this::toFolderDto)
                .toList();
    }

    @Override
    @Transactional
    public DishwareInventoryFolderDto createFolder(Long restaurantId, Long currentUserId, CreateDishwareInventoryFolderRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        DishwareInventoryFolder parent = resolveActiveFolder(restaurantId, request.parentId());
        DishwareInventoryFolder entity = DishwareInventoryFolder.builder()
                .restaurant(restaurant)
                .parent(parent)
                .name(normalizeFolderName(request.name()))
                .description(normalizeText(request.description(), false))
                .sortOrder(request.sortOrder() == null ? 0 : request.sortOrder())
                .build();
        return toFolderDto(folders.save(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryFolderDto updateFolder(Long restaurantId, Long currentUserId, Long folderId, UpdateDishwareInventoryFolderRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventoryFolder entity = requireFolder(restaurantId, folderId);
        entity.setName(normalizeFolderName(request.name()));
        entity.setDescription(normalizeText(request.description(), false));
        entity.setSortOrder(request.sortOrder() == null ? entity.getSortOrder() : request.sortOrder());
        return toFolderDto(folders.save(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryFolderDto moveFolder(Long restaurantId, Long currentUserId, Long folderId, MoveDishwareInventoryFolderRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventoryFolder entity = requireFolder(restaurantId, folderId);
        DishwareInventoryFolder parent = resolveActiveFolder(restaurantId, request.parentId());
        if (parent != null) {
            ensureNotMovingIntoSelfOrDescendant(restaurantId, entity.getId(), parent.getId());
        }
        entity.setParent(parent);
        if (request.sortOrder() != null) {
            entity.setSortOrder(request.sortOrder());
        }
        return toFolderDto(folders.save(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryFolderDto trashFolder(Long restaurantId, Long currentUserId, Long folderId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventoryFolder entity = requireFolder(restaurantId, folderId);
        if (entity.getTrashedAt() == null) {
            entity.setTrashedAt(Instant.now());
        }
        return toFolderDto(folders.save(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryFolderDto restoreFolder(Long restaurantId, Long currentUserId, Long folderId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventoryFolder entity = requireFolder(restaurantId, folderId);
        entity.setTrashedAt(null);
        return toFolderDto(folders.save(entity));
    }

    @Override
    @Transactional
    public void deleteFolderPermanently(Long restaurantId, Long currentUserId, Long folderId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventoryFolder root = requireFolder(restaurantId, folderId);
        if (root.getTrashedAt() == null) {
            throw new BadRequestException("Сначала переместите папку в корзину");
        }
        List<Long> folderIds = collectFolderIds(restaurantId, folderId);
        List<DishwareInventory> folderInventories = inventories.findByRestaurantIdAndFolderIdIn(restaurantId, folderIds);
        deleteInventoriesPermanently(folderInventories);
        folders.deleteAllByIdInBatch(folderIds);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public DishwareInventoryDto get(Long restaurantId, Long currentUserId, Long inventoryId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory inventory = requireInventory(restaurantId, inventoryId);
        requireNotTrashed(inventory);
        return mapper.toDto(inventory);
    }

    @Override
    @Transactional
    public DishwareInventoryDto create(Long restaurantId, Long currentUserId, CreateDishwareInventoryRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        LocalDate inventoryDate = requireInventoryDate(request.inventoryDate());
        DishwareInventory sourceInventory = null;
        if (request.sourceInventoryId() != null) {
            sourceInventory = requireInventoryForUpdate(restaurantId, request.sourceInventoryId());
            requireNotTrashed(sourceInventory);
            requireCompletedSource(sourceInventory);
        }
        DishwareInventoryFolder folder = resolveActiveFolder(restaurantId, request.folderId());

        DishwareInventory entity = DishwareInventory.builder()
                .restaurant(restaurant)
                .folder(folder)
                .sourceInventory(sourceInventory)
                .sourceInventoryTitle(sourceInventory != null ? sourceInventory.getTitle() : null)
                .title(resolveTitle(request.title(), inventoryDate))
                .inventoryDate(inventoryDate)
                .status(DishwareInventoryStatus.DRAFT)
                .comment(normalizeComment(request.comment()))
                .build();

        if (sourceInventory != null) {
            DishwareInventory targetInventory = entity;
            List<DishwareInventoryItem> clones = sourceInventory.getItems().stream()
                    .sorted(Comparator.comparingInt(DishwareInventoryItem::getSortOrder).thenComparing(DishwareInventoryItem::getId))
                    .map(sourceItem -> DishwareInventoryItem.builder()
                            .inventory(targetInventory)
                            .sortOrder(sourceItem.getSortOrder())
                            .name(sourceItem.getName())
                            .photoUrl(null)
                            .previousQty(sourceItem.getCurrentQty())
                            .incomingQty(0)
                            .currentQty(sourceItem.getCurrentQty())
                            .unitPrice(sourceItem.getUnitPrice())
                            .note(sourceItem.getNote())
                            .build())
                    .toList();
            entity.getItems().addAll(clones);
        }

        entity = inventories.save(entity);
        if (sourceInventory != null) {
            copyClonedImages(sourceInventory, entity);
            entity = inventories.save(entity);
        }
        return mapper.toDto(entity);
    }

    @Override
    @Transactional
    public DishwareInventoryDto update(Long restaurantId, Long currentUserId, Long inventoryId, UpdateDishwareInventoryRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory entity = requireInventory(restaurantId, inventoryId);
        requireNotTrashed(entity);
        requireDraft(entity, "Завершенную инвентаризацию нельзя редактировать");

        LocalDate inventoryDate = requireInventoryDate(request.inventoryDate());

        entity.setTitle(resolveTitle(request.title(), inventoryDate));
        entity.setInventoryDate(inventoryDate);
        entity.setFolder(resolveActiveFolder(restaurantId, request.folderId()));
        entity.setComment(normalizeComment(request.comment()));
        syncItems(entity, request.items());

        entity = inventories.save(entity);
        return mapper.toDto(entity);
    }

    @Override
    @Transactional
    public DishwareInventoryDto complete(Long restaurantId, Long currentUserId, Long inventoryId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory entity = requireInventory(restaurantId, inventoryId);
        requireNotTrashed(entity);
        requireDraft(entity, "Инвентаризация уже завершена");
        requireCompletable(entity);

        applyStatus(entity, DishwareInventoryStatus.COMPLETED);
        return mapper.toDto(inventories.save(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryDto reopen(Long restaurantId, Long currentUserId, Long inventoryId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory entity = requireInventoryForUpdate(restaurantId, inventoryId);
        requireNotTrashed(entity);
        requireCompleted(entity, "Вернуть в черновик можно только завершенную инвентаризацию");
        requireNoDerivedInventories(entity);

        applyStatus(entity, DishwareInventoryStatus.DRAFT);
        return mapper.toDto(inventories.save(entity));
    }

    @Override
    @Transactional
    public void delete(Long restaurantId, Long currentUserId, Long inventoryId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory entity = requireInventory(restaurantId, inventoryId);
        if (entity.getTrashedAt() == null && !isInTrashedFolder(entity, effectivelyTrashedFolderIds(restaurantId))) {
            throw new BadRequestException("Сначала переместите документ в корзину");
        }
        deleteInventoriesPermanently(List.of(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryDto move(Long restaurantId, Long currentUserId, Long inventoryId, MoveDishwareInventoryRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory entity = requireInventory(restaurantId, inventoryId);
        requireNotTrashed(entity);
        entity.setFolder(resolveActiveFolder(restaurantId, request.folderId()));
        return mapper.toDto(inventories.save(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryDto trash(Long restaurantId, Long currentUserId, Long inventoryId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory entity = requireInventory(restaurantId, inventoryId);
        if (entity.getTrashedAt() == null) {
            entity.setTrashedAt(Instant.now());
        }
        return mapper.toDto(inventories.save(entity));
    }

    @Override
    @Transactional
    public DishwareInventoryDto restore(Long restaurantId, Long currentUserId, Long inventoryId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventory entity = requireInventory(restaurantId, inventoryId);
        entity.setTrashedAt(null);
        return mapper.toDto(inventories.save(entity));
    }

    private void deleteInventoryPermanently(DishwareInventory entity) {
        List<Long> itemIds = entity.getItems().stream()
                .map(DishwareInventoryItem::getId)
                .filter(Objects::nonNull)
                .toList();
        List<String> photoUrls = entity.getItems().stream()
                .map(DishwareInventoryItem::getPhotoUrl)
                .filter(Objects::nonNull)
                .filter(url -> !url.isBlank())
                .toList();

        for (DishwareInventoryItem item : entity.getItems()) {
            item.setPhotoUrl(null);
        }
        inventories.delete(entity);

        afterCommit(() -> {
            photoUrls.forEach(storage::deleteByPublicUrl);
            itemIds.forEach(storage::deleteItemFolder);
        });
    }

    @Override
    @Transactional
    public DishwareInventoryDto uploadItemImage(Long restaurantId, Long currentUserId, Long inventoryId, Long itemId, MultipartFile file) throws IOException {
        security.assertAtLeastManager(currentUserId, restaurantId);
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не выбран");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BadRequestException("Файл больше 2MB");
        }

        validateImage(file);
        DishwareInventoryItem item = items.findByIdAndInventoryIdAndRestaurantId(itemId, inventoryId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Inventory item not found"));
        requireDraft(item.getInventory(), "В завершенной инвентаризации нельзя менять фото");

        String previousPhotoUrl = item.getPhotoUrl();
        String uploadedPhotoUrl = storage.saveForItem(itemId, file);
        item.setPhotoUrl(uploadedPhotoUrl);

        afterCommit(() -> {
            if (previousPhotoUrl != null && !previousPhotoUrl.equals(uploadedPhotoUrl)) {
                storage.deleteByPublicUrl(previousPhotoUrl);
            }
            storage.deleteItemFolderIfNoUrlMatch(item.getId(), uploadedPhotoUrl);
        });
        afterRollback(() -> storage.deleteByPublicUrl(uploadedPhotoUrl));
        return mapper.toDto(item.getInventory());
    }

    @Override
    @Transactional
    public DishwareInventoryDto deleteItemImage(Long restaurantId, Long currentUserId, Long inventoryId, Long itemId) throws IOException {
        security.assertAtLeastManager(currentUserId, restaurantId);
        DishwareInventoryItem item = items.findByIdAndInventoryIdAndRestaurantId(itemId, inventoryId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Inventory item not found"));
        requireDraft(item.getInventory(), "В завершенной инвентаризации нельзя удалять фото");

        String previousPhotoUrl = item.getPhotoUrl();
        item.setPhotoUrl(null);

        afterCommit(() -> {
            storage.deleteByPublicUrl(previousPhotoUrl);
            storage.deleteItemFolder(item.getId());
        });
        return mapper.toDto(item.getInventory());
    }

    private DishwareInventory requireInventory(Long restaurantId, Long inventoryId) {
        return inventories.findByIdAndRestaurantId(inventoryId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Inventory not found: " + inventoryId));
    }

    private DishwareInventory requireInventoryForUpdate(Long restaurantId, Long inventoryId) {
        return inventories.findWithLockByIdAndRestaurantId(inventoryId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Inventory not found: " + inventoryId));
    }

    private DishwareInventoryFolder requireFolder(Long restaurantId, Long folderId) {
        return folders.findByIdAndRestaurantId(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Inventory folder not found: " + folderId));
    }

    private DishwareInventoryFolder resolveActiveFolder(Long restaurantId, Long folderId) {
        if (folderId == null) {
            return null;
        }
        DishwareInventoryFolder folder = requireFolder(restaurantId, folderId);
        if (effectivelyTrashedFolderIds(restaurantId).contains(folder.getId())) {
            throw new BadRequestException("Нельзя выбрать папку из корзины");
        }
        return folder;
    }

    private void requireNotTrashed(DishwareInventory inventory) {
        if (inventory.getTrashedAt() != null) {
            throw new NotFoundException("Inventory not found: " + inventory.getId());
        }
        if (inventory.getFolder() != null && effectivelyTrashedFolderIds(inventory.getRestaurant().getId()).contains(inventory.getFolder().getId())) {
            throw new NotFoundException("Inventory not found: " + inventory.getId());
        }
    }

    private boolean isInTrashedFolder(DishwareInventory inventory, Set<Long> effectivelyTrashedFolderIds) {
        return inventory.getFolder() != null && effectivelyTrashedFolderIds.contains(inventory.getFolder().getId());
    }

    private Set<Long> effectivelyTrashedFolderIds(Long restaurantId) {
        List<DishwareInventoryFolder> allFolders = folders.findByRestaurantIdOrderBySortOrderAscNameAsc(restaurantId);
        Map<Long, DishwareInventoryFolder> folderById = allFolders.stream()
                .collect(Collectors.toMap(DishwareInventoryFolder::getId, folder -> folder));
        Set<Long> trashed = new HashSet<>();
        for (DishwareInventoryFolder folder : allFolders) {
            if (isFolderEffectivelyTrashed(folder, folderById, trashed, new HashSet<>())) {
                trashed.add(folder.getId());
            }
        }
        return trashed;
    }

    private boolean isFolderEffectivelyTrashed(DishwareInventoryFolder folder,
                                               Map<Long, DishwareInventoryFolder> folderById,
                                               Set<Long> knownTrashed,
                                               Set<Long> seen) {
        if (folder.getTrashedAt() != null || knownTrashed.contains(folder.getId())) {
            return true;
        }
        if (folder.getParent() == null || folder.getParent().getId() == null || !seen.add(folder.getId())) {
            return false;
        }
        DishwareInventoryFolder parent = folderById.get(folder.getParent().getId());
        return parent != null && isFolderEffectivelyTrashed(parent, folderById, knownTrashed, seen);
    }

    private void ensureNotMovingIntoSelfOrDescendant(Long restaurantId, Long folderId, Long candidateParentId) {
        if (Objects.equals(folderId, candidateParentId)) {
            throw new BadRequestException("Нельзя переместить папку в саму себя");
        }
        if (collectFolderIds(restaurantId, folderId).contains(candidateParentId)) {
            throw new BadRequestException("Нельзя переместить папку в свою подпапку");
        }
    }

    private List<Long> collectFolderIds(Long restaurantId, Long rootId) {
        List<DishwareInventoryFolder> allFolders = folders.findByRestaurantIdOrderBySortOrderAscNameAsc(restaurantId);
        Map<Long, List<Long>> childrenByParent = allFolders.stream()
                .filter(folder -> folder.getParent() != null)
                .collect(Collectors.groupingBy(
                        folder -> folder.getParent().getId(),
                        Collectors.mapping(DishwareInventoryFolder::getId, Collectors.toList())
                ));

        List<Long> result = new ArrayList<>();
        ArrayDeque<Long> queue = new ArrayDeque<>();
        queue.add(rootId);
        while (!queue.isEmpty()) {
            Long id = queue.removeFirst();
            result.add(id);
            queue.addAll(childrenByParent.getOrDefault(id, List.of()));
        }
        return result;
    }

    private DishwareInventoryFolderDto toFolderDto(DishwareInventoryFolder entity) {
        return new DishwareInventoryFolderDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getParent() == null ? null : entity.getParent().getId(),
                entity.getName(),
                entity.getDescription(),
                entity.getSortOrder(),
                entity.getTrashedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private String normalizeFolderName(String value) {
        String name = normalizeText(value, true);
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Название папки обязательно");
        }
        return name;
    }

    private void deleteInventoriesPermanently(List<DishwareInventory> entities) {
        for (DishwareInventory entity : entities) {
            deleteInventoryPermanently(entity);
        }
    }

    private LocalDate requireInventoryDate(LocalDate inventoryDate) {
        if (inventoryDate == null) {
            throw new BadRequestException("Дата инвентаризации обязательна");
        }
        return inventoryDate;
    }

    private void applyStatus(DishwareInventory entity, DishwareInventoryStatus nextStatus) {
        if (entity.getStatus() == nextStatus) {
            return;
        }
        entity.setStatus(nextStatus);
        if (nextStatus == DishwareInventoryStatus.COMPLETED) {
            entity.setCompletedAt(Instant.now());
        } else {
            entity.setCompletedAt(null);
        }
    }

    private void requireDraft(DishwareInventory entity, String message) {
        if (entity.getStatus() != DishwareInventoryStatus.DRAFT) {
            throw new BadRequestException(message);
        }
    }

    private void requireCompleted(DishwareInventory entity, String message) {
        if (entity.getStatus() != DishwareInventoryStatus.COMPLETED) {
            throw new BadRequestException(message);
        }
    }

    private void requireCompletable(DishwareInventory entity) {
        if (entity.getItems() == null || entity.getItems().isEmpty()) {
            throw new BadRequestException("Нельзя завершить пустую инвентаризацию");
        }
    }

    private void requireCompletedSource(DishwareInventory sourceInventory) {
        if (sourceInventory.getStatus() != DishwareInventoryStatus.COMPLETED) {
            throw new BadRequestException("Новой инвентаризации можно брать за основу только завершенный документ");
        }
    }

    private void requireNoDerivedInventories(DishwareInventory entity) {
        if (entity.getId() != null && inventories.existsBySourceInventoryId(entity.getId())) {
            throw new BadRequestException("Нельзя вернуть в черновик документ, на основе которого уже создали новую инвентаризацию");
        }
    }

    private void syncItems(DishwareInventory entity, List<UpsertDishwareInventoryItemRequest> requests) {
        List<UpsertDishwareInventoryItemRequest> safeRequests = requests;
        Map<Long, DishwareInventoryItem> existingById = entity.getItems().stream()
                .filter(item -> item.getId() != null)
                .collect(Collectors.toMap(DishwareInventoryItem::getId, item -> item));

        List<DishwareInventoryItem> nextItems = new ArrayList<>();
        for (int index = 0; index < safeRequests.size(); index++) {
            UpsertDishwareInventoryItemRequest request = safeRequests.get(index);
            DishwareInventoryItem item;
            if (request.id() != null) {
                item = existingById.remove(request.id());
                if (item == null) {
                    throw new BadRequestException("Строка инвентаризации не найдена: " + request.id());
                }
            } else {
                item = DishwareInventoryItem.builder().inventory(entity).build();
            }

            applyItem(item, request, index);
            nextItems.add(item);
        }

        List<Long> removedItemIds = existingById.values().stream()
                .map(DishwareInventoryItem::getId)
                .filter(Objects::nonNull)
                .toList();
        List<String> removedPhotoUrls = existingById.values().stream()
                .map(DishwareInventoryItem::getPhotoUrl)
                .filter(Objects::nonNull)
                .filter(url -> !url.isBlank())
                .toList();

        for (DishwareInventoryItem removedItem : existingById.values()) {
            removedItem.setPhotoUrl(null);
        }

        entity.getItems().clear();
        entity.getItems().addAll(nextItems);

        afterCommit(() -> {
            removedPhotoUrls.forEach(storage::deleteByPublicUrl);
            removedItemIds.forEach(storage::deleteItemFolder);
        });
    }

    private void applyItem(DishwareInventoryItem item, UpsertDishwareInventoryItemRequest request, int index) {
        String name = normalizeText(request.name(), true);
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Название позиции обязательно");
        }
        int previousQty = normalizeQty(request.previousQty());
        int incomingQty = normalizeQty(request.incomingQty());
        int currentQty = normalizeQty(request.currentQty());
        BigDecimal unitPrice = normalizeUnitPrice(request.unitPrice());
        String note = normalizeText(request.note(), false);

        item.setName(name);
        item.setPreviousQty(previousQty);
        item.setIncomingQty(incomingQty);
        item.setCurrentQty(currentQty);
        item.setUnitPrice(unitPrice);
        item.setSortOrder(request.sortOrder() != null ? request.sortOrder() : index);
        item.setNote(note);
    }

    private int normalizeQty(Integer value) {
        if (value == null) {
            return 0;
        }
        if (value < 0) {
            throw new BadRequestException("Количество не может быть отрицательным");
        }
        return value;
    }

    private BigDecimal normalizeUnitPrice(BigDecimal value) {
        if (value == null) {
            return null;
        }
        if (value.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Цена не может быть отрицательной");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String resolveTitle(String rawTitle, LocalDate inventoryDate) {
        String title = normalizeText(rawTitle, true);
        return title == null || title.isBlank()
                ? "Инвентаризация посуды от " + TITLE_DATE_FORMATTER.format(inventoryDate)
                : title;
    }

    private String normalizeComment(String value) {
        return normalizeText(value, false);
    }

    private String normalizeText(String value, boolean requiredField) {
        if (value == null) {
            return requiredField ? null : null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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

    private void copyClonedImages(DishwareInventory sourceInventory, DishwareInventory targetInventory) {
        List<DishwareInventoryItem> sourceItems = sourceInventory.getItems().stream()
                .sorted(Comparator.comparingInt(DishwareInventoryItem::getSortOrder).thenComparing(DishwareInventoryItem::getId))
                .toList();
        List<DishwareInventoryItem> targetItems = targetInventory.getItems().stream()
                .sorted(Comparator.comparingInt(DishwareInventoryItem::getSortOrder).thenComparing(DishwareInventoryItem::getId))
                .toList();

        int pairCount = Math.min(sourceItems.size(), targetItems.size());
        for (int index = 0; index < pairCount; index++) {
            DishwareInventoryItem sourceItem = sourceItems.get(index);
            DishwareInventoryItem targetItem = targetItems.get(index);
            if (sourceItem.getPhotoUrl() == null || sourceItem.getPhotoUrl().isBlank() || targetItem.getId() == null) {
                continue;
            }

            String copiedUrl = storage.copyFromPublicUrlToItem(sourceItem.getPhotoUrl(), targetItem.getId());
            if (copiedUrl == null) {
                throw new BadRequestException("Не удалось скопировать фото из прошлой инвентаризации");
            }
            targetItem.setPhotoUrl(copiedUrl);
            afterRollback(() -> storage.deleteByPublicUrl(copiedUrl));
        }
    }

    private void afterCommit(Runnable action) {
        registerTransactionCallback(action, null);
    }

    private void afterRollback(Runnable action) {
        registerTransactionCallback(null, action);
    }

    private void registerTransactionCallback(Runnable afterCommitAction, Runnable afterRollbackAction) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            if (afterCommitAction != null) {
                afterCommitAction.run();
            }
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                if (afterCommitAction != null) {
                    afterCommitAction.run();
                }
            }

            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED && afterRollbackAction != null) {
                    afterRollbackAction.run();
                }
            }
        });
    }
}
