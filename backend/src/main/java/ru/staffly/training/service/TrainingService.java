package ru.staffly.training.service;

import ru.staffly.training.dto.TrainingCategoryDto;
import ru.staffly.training.dto.TrainingItemDto;
import ru.staffly.training.model.TrainingModule;

import java.util.List;

public interface TrainingService {
    // CATEGORY
    TrainingCategoryDto createCategory(Long restaurantId, Long currentUserId, TrainingCategoryDto dto);
    List<TrainingCategoryDto> listCategories(Long restaurantId, Long currentUserId, TrainingModule module, boolean allForManagers);
    TrainingCategoryDto updateCategory(Long restaurantId, Long currentUserId, Long categoryId, TrainingCategoryDto dto);
    void deleteCategory(Long restaurantId, Long currentUserId, Long categoryId);

    // ITEM
    TrainingItemDto createItem(Long restaurantId, Long currentUserId, TrainingItemDto dto);
    List<TrainingItemDto> listItems(Long restaurantId, Long currentUserId, Long categoryId);
    TrainingItemDto updateItem(Long restaurantId, Long currentUserId, Long itemId, TrainingItemDto dto);
    void deleteItem(Long restaurantId, Long currentUserId, Long itemId);
}