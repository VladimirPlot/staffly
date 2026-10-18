package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record DishwareInventoryVersionRequest(@NotNull @PositiveOrZero Long expectedVersion) {}
