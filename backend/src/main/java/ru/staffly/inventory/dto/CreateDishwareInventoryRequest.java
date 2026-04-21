package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateDishwareInventoryRequest(
        String title,
        @NotNull LocalDate inventoryDate,
        Long sourceInventoryId,
        String comment
) {}
