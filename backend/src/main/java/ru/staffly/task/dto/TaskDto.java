package ru.staffly.task.dto;

public record TaskDto(
        Long id,
        Long restaurantId,
        String title,
        String description,
        String priority,
        String dueDate,
        String status,
        String completedAt,
        boolean assignedToAll,
        TaskPositionDto assignedPosition,
        TaskUserDto assignedUser,
        TaskUserDto createdBy,
        String createdAt
) {
}