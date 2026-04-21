package ru.staffly.inventory.service;

import org.springframework.web.multipart.MultipartFile;
import ru.staffly.inventory.dto.CreateDishwareInventoryRequest;
import ru.staffly.inventory.dto.DishwareInventoryDto;
import ru.staffly.inventory.dto.DishwareInventorySummaryDto;
import ru.staffly.inventory.dto.UpdateDishwareInventoryRequest;

import java.io.IOException;
import java.util.List;

public interface DishwareInventoryService {

    List<DishwareInventorySummaryDto> list(Long restaurantId, Long currentUserId);

    DishwareInventoryDto get(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto create(Long restaurantId, Long currentUserId, CreateDishwareInventoryRequest request);

    DishwareInventoryDto update(Long restaurantId, Long currentUserId, Long inventoryId, UpdateDishwareInventoryRequest request);

    DishwareInventoryDto complete(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto reopen(Long restaurantId, Long currentUserId, Long inventoryId);

    void delete(Long restaurantId, Long currentUserId, Long inventoryId);

    DishwareInventoryDto uploadItemImage(Long restaurantId, Long currentUserId, Long inventoryId, Long itemId, MultipartFile file) throws IOException;

    DishwareInventoryDto deleteItemImage(Long restaurantId, Long currentUserId, Long inventoryId, Long itemId) throws IOException;
}
