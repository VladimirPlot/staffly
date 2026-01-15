package ru.staffly.task.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TaskCreateRequest(
        @NotBlank(message = "Название обязательно")
        @Size(max = 200, message = "Название не должно превышать 200 символов")
        String title,
        String description,
        String priority,
        String dueDate,
        Long assignedUserId,
        Long assignedPositionId,
        Boolean assignedToAll
) {
}