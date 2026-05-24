package ru.staffly.inventory.dto;

import java.time.Instant;

public record DishwareInventoryFolderDto(
        Long id,
        Long restaurantId,
        Long parentId,
        String name,
        String description,
        Integer sortOrder,
        Instant trashedAt,
        Instant createdAt,
        Instant updatedAt
) {}
