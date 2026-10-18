package ru.staffly.inventory.dto;

import jakarta.validation.constraints.*;

public record ReopenDishwareInventoryRequest(@NotNull @PositiveOrZero Long expectedVersion,
        @NotBlank @Size(max = 1000) String reason) {}
