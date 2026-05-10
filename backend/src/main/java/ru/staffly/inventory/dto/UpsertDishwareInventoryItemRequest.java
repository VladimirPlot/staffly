package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpsertDishwareInventoryItemRequest(
        Long id,
        @NotBlank @Size(max = 200) String name,
        @PositiveOrZero Integer previousQty,
        @PositiveOrZero Integer incomingQty,
        @PositiveOrZero Integer currentQty,
        @PositiveOrZero BigDecimal unitPrice,
        Integer sortOrder,
        @Size(max = 2000) String note
) {}
