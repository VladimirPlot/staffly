package ru.staffly.task.dto;

import jakarta.validation.constraints.NotBlank;

public record TaskCommentRequest(
        @NotBlank(message = "Текст комментария обязателен")
        String text
) {
}