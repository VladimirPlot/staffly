package ru.staffly.inventory.dto;

import java.math.BigDecimal;

public record DishwareInventoryItemDto(
        Long id,
        String name,
        String photoUrl,
        Integer previousQty,
        Integer currentQty,
        BigDecimal unitPrice,
        Integer sortOrder,
        String note,
        Integer diffQty,
        Integer lossQty,
        Integer gainQty,
        BigDecimal lossAmount
) {}
