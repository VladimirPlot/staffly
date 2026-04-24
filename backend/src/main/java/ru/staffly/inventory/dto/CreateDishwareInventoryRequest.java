package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CreateDishwareInventoryRequest(
        @Size(max = 200) String title,
        @NotNull LocalDate inventoryDate,
        Long folderId,
        Long sourceInventoryId,
        @Size(max = 5000) String comment
) {}
