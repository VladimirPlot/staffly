package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import ru.staffly.inventory.DishwareInventoryLimits;

import java.math.BigDecimal;

public record UpsertDishwareInventoryItemRequest(
        Long id,
        @NotBlank @Size(max = 200) String name,
        @PositiveOrZero @Max(DishwareInventoryLimits.MAX_ITEM_QUANTITY) Integer previousQty,
        @PositiveOrZero @Max(DishwareInventoryLimits.MAX_ITEM_QUANTITY) Integer incomingQty,
        @PositiveOrZero @Max(DishwareInventoryLimits.MAX_ITEM_QUANTITY) Integer currentQty,
        @PositiveOrZero BigDecimal unitPrice,
        Integer sortOrder,
        @Size(max = 2000) String note
) {}
