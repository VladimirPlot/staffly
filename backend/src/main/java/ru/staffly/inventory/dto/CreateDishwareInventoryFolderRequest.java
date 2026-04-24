package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateDishwareInventoryFolderRequest(
        Long parentId,
        @NotBlank @Size(max = 150) String name,
        @Size(max = 5000) String description,
        Integer sortOrder
) {}
