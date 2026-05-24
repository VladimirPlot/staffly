package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDishwareInventoryFolderRequest(
        @NotBlank @Size(max = 150) String name,
        @Size(max = 5000) String description,
        Integer sortOrder
) {}
