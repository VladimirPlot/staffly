package ru.staffly.task.dto;

import java.util.List;

public record TaskCommentPageDto(
        List<TaskCommentDto> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        boolean hasNext
) {
}