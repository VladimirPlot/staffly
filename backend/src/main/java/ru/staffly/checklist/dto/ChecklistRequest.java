package ru.staffly.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ChecklistRequest(
        @NotBlank(message = "Название обязательно")
        @Size(max = 200, message = "Название не должно превышать 200 символов")
        String name,

        @NotBlank(message = "Содержимое обязательно")
        String content,

        List<Long> positionIds
) {
}