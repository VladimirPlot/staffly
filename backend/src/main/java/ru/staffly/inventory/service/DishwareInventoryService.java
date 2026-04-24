package ru.staffly.inventory.service;

import org.springframework.web.multipart.MultipartFile;
import ru.staffly.inventory.dto.CreateDishwareInventoryRequest;
import ru.staffly.inventory.dto.CreateDishwareInventoryFolderRequest;
import ru.staffly.inventory.dto.DishwareInventoryDto;
import ru.staffly.inventory.dto.DishwareInventoryFolderDto;
import ru.staffly.inventory.dto.DishwareInventorySummaryDto;
import ru.staffly.inventory.dto.MoveDishwareInventoryFolderRequest;
import ru.staffly.inventory.dto.MoveDishwareInventoryRequest;
import ru.staffly.inventory.dto.UpdateDishwareInventoryFolderRequest;
import ru.staffly.inventory.dto.UpdateDishwareInventoryRequest;

import java.io.IOException;
import java.util.List;

public interface DishwareInventoryService {

    List<DishwareInventorySummaryDto> list(Long restaurantId, Long currentUserId);

    List<DishwareInventorySummaryDto> listTrash(Long restaurantId, Long currentUserId);

    List<DishwareInventoryFolderDto> listFolders(Long restaurantId, Long currentUserId, boolean includeTrashed);

    DishwareInventoryFolderDto createFolder(Long restaurantId, Long currentUserId, CreateDishwareInventoryFolderRequest request);

    DishwareInventoryFolderDto updateFolder(Long restaurantId, Long currentUserId, Long folderId, UpdateDishwareInventoryFolderRequest request);

    DishwareInventoryFolderDto moveFolder(Long restaurantId, Long currentUserId, Long folderId, MoveDishwareInventoryFolderRequest request);

    DishwareInventoryFolderDto trashFolder(Long restaurantId, Long currentUserId, Long folderId);

    DishwareInventoryFolderDto restoreFolder(Long restaurantId, Long currentUserId, Long folderId);

    void deleteFolderPermanently(Long restaurantId, Long currentUserId, Long folderId);

    DishwareInventoryDto get(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto create(Long restaurantId, Long currentUserId, CreateDishwareInventoryRequest request);

    DishwareInventoryDto update(Long restaurantId, Long currentUserId, Long inventoryId, UpdateDishwareInventoryRequest request);

    DishwareInventoryDto complete(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto reopen(Long restaurantId, Long currentUserId, Long inventoryId);

    void delete(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto move(Long restaurantId, Long currentUserId, Long inventoryId, MoveDishwareInventoryRequest request);

    DishwareInventoryDto trash(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto restore(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto uploadItemImage(Long restaurantId, Long currentUserId, Long inventoryId, Long itemId, MultipartFile file) throws IOException;

    DishwareInventoryDto deleteItemImage(Long restaurantId, Long currentUserId, Long inventoryId, Long itemId) throws IOException;
}
