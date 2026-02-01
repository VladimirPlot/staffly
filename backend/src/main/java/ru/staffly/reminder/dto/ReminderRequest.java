package ru.staffly.reminder.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReminderRequest(
        @NotBlank(message = "Название обязательно")
        @Size(max = 200, message = "Название не должно превышать 200 символов")
        String title,
        String description,
        Boolean visibleToAdmin,
        String targetType,
        Long targetPositionId,
        Long targetMemberId,
        String periodicity,
        String time,
        Integer dayOfWeek,
        Integer dayOfMonth,
        Boolean monthlyLastDay,
        String onceDate
) {
}
