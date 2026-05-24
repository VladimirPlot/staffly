package ru.staffly.training.dto;

public record MoveTrainingFolderRequest(
        Long parentId,
        Integer sortOrder
) {}
