package ru.staffly.training.dto;

public record MoveTrainingQuestionRequest(
        Long folderId,
        Integer sortOrder
) {}
