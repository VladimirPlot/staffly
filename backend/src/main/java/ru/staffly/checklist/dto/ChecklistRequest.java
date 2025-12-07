package ru.staffly.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ChecklistRequest(
        @NotBlank(message = "Название обязательно")
        @Size(max = 200, message = "Название не должно превышать 200 символов")
        String name,

        String content,

        String kind,

        String periodicity,

        String resetTime,

        Integer resetDayOfWeek,

        Integer resetDayOfMonth,

        List<String> items,

        List<Long> positionIds
) {
}