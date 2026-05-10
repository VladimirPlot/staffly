package ru.staffly.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ReorderDishwareInventoryObjectsRequest(
        Long folderId,
        @NotNull @Valid List<ObjectOrder> objects
) {
    public record ObjectOrder(
            @NotNull String kind,
            @NotNull Long id,
            @NotNull Integer sortOrder
    ) {}
}
