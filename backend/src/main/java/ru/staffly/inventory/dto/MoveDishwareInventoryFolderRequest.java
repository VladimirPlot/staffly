package ru.staffly.inventory.dto;

public record MoveDishwareInventoryFolderRequest(
        Long parentId,
        Integer sortOrder
) {}
