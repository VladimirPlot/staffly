package ru.staffly.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record DishwareInventoryDto(
        Long id,
        Long restaurantId,
        String title,
        LocalDate inventoryDate,
        String status,
        Long folderId,
        Long sourceInventoryId,
        String sourceInventoryTitle,
        String comment,
        Integer itemsCount,
        Integer totalLossQty,
        BigDecimal totalLossAmount,
        Instant createdAt,
        Instant updatedAt,
        Instant completedAt,
        Instant trashedAt,
        List<DishwareInventoryItemDto> items
) {}
