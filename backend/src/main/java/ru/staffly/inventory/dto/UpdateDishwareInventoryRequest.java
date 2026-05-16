package ru.staffly.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.staffly.inventory.DishwareInventoryLimits;

import java.time.LocalDate;
import java.util.List;

public record UpdateDishwareInventoryRequest(
        @Size(max = 200) String title,
        @NotNull LocalDate inventoryDate,
        Long folderId,
        @Size(max = 5000) String comment,
        @NotNull @Size(max = DishwareInventoryLimits.MAX_ITEMS_PER_INVENTORY) @Valid List<UpsertDishwareInventoryItemRequest> items
) {}
