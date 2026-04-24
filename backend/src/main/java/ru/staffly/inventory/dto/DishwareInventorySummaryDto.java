package ru.staffly.inventory.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;

public record DishwareInventorySummaryDto(
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
        Instant trashedAt
) {}
