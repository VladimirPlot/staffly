package ru.staffly.task.dto;

public record TaskCommentDto(
        Long id,
        Long taskId,
        TaskUserDto author,
        String text,
        String createdAt
) {
}