package ru.staffly.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record UpdateDishwareInventoryRequest(
        @Size(max = 200) String title,
        @NotNull LocalDate inventoryDate,
        @NotNull String status,
        @Size(max = 5000) String comment,
        @NotNull @Valid List<UpsertDishwareInventoryItemRequest> items
) {}
