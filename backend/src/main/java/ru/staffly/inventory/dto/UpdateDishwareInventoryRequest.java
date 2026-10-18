package ru.staffly.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import ru.staffly.inventory.DishwareInventoryLimits;

import java.time.LocalDate;
import java.util.List;

public record UpdateDishwareInventoryRequest(
        @Size(max = 200) String title,
        @NotNull LocalDate inventoryDate,
        Long folderId,
        @Size(max = 5000) String comment,
        @NotNull @Size(max = DishwareInventoryLimits.MAX_ITEMS_PER_INVENTORY) @Valid List<UpsertDishwareInventoryItemRequest> items,
        @NotNull @PositiveOrZero Long expectedVersion,
        @NotNull java.util.UUID requestId,
        Boolean includeSurplus
) {
    public UpdateDishwareInventoryRequest(String title, LocalDate inventoryDate, Long folderId, String comment,
            List<UpsertDishwareInventoryItemRequest> items, Long expectedVersion, java.util.UUID requestId) {
        this(title, inventoryDate, folderId, comment, items, expectedVersion, requestId, null);
    }
}
