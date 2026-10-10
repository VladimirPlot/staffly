package ru.staffly.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.Valid;

import java.util.List;

public record ChecklistRequest(
        @NotBlank(message = "Название обязательно")
        @Size(max = 200, message = "Название не должно превышать 200 символов")
        String name,

        @Size(max = 100000) String content,

        String kind,

        String periodicity,

        String resetTime,

        Integer resetDayOfWeek,

        Integer resetDayOfMonth,

        @Size(max = 300) List<@NotBlank @Size(max = 4000) String> items,

        @Size(max = 300) List<@NotNull @Valid ChecklistItemRequest> itemDetails,

        @NotNull @Size(min = 1, max = 100) List<@NotNull @Positive Long> positionIds
) {
}
