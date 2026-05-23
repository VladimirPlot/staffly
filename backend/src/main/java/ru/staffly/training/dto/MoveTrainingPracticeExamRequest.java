package ru.staffly.training.dto;

public record MoveTrainingPracticeExamRequest(
        Long knowledgeFolderId,
        Integer sortOrder
) {}
