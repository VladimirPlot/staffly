package ru.staffly.training.service;

import ru.staffly.training.dto.TrainingCategoryDto;
import ru.staffly.training.dto.TrainingItemDto;
import ru.staffly.training.model.TrainingModule;

import java.util.List;

public interface TrainingService {
    // CATEGORY
    TrainingCategoryDto createCategory(Long restaurantId, Long currentUserId, TrainingCategoryDto dto);
    List<TrainingCategoryDto> listCategories(Long restaurantId, Long currentUserId, TrainingModule module, boolean allForManagers, boolean includeInactive);
    TrainingCategoryDto updateCategory(Long restaurantId, Long currentUserId, Long categoryId, TrainingCategoryDto dto);
    TrainingCategoryDto hideCategory(Long restaurantId, Long currentUserId, Long categoryId);
    TrainingCategoryDto restoreCategory(Long restaurantId, Long currentUserId, Long categoryId);
    void deleteCategory(Long restaurantId, Long currentUserId, Long categoryId);

    // ITEM
    TrainingItemDto createItem(Long restaurantId, Long currentUserId, TrainingItemDto dto);
    List<TrainingItemDto> listItems(Long restaurantId, Long currentUserId, Long categoryId, boolean includeInactive);
    TrainingItemDto updateItem(Long restaurantId, Long currentUserId, Long itemId, TrainingItemDto dto);
    TrainingItemDto hideItem(Long restaurantId, Long currentUserId, Long itemId);
    TrainingItemDto restoreItem(Long restaurantId, Long currentUserId, Long itemId);
    void deleteItem(Long restaurantId, Long currentUserId, Long itemId);
}
