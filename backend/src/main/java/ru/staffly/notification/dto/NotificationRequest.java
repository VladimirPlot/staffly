package ru.staffly.notification.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record NotificationRequest(
        @NotBlank(message = "Текст уведомления обязателен")
        @Size(max = 2000, message = "Слишком длинное уведомление")
        String content,

        @NotNull(message = "Укажите дату окончания")
        @FutureOrPresent(message = "Дата окончания не может быть в прошлом")
        LocalDate expiresAt,

        @NotEmpty(message = "Нужна хотя бы одна должность")
        List<Long> positionIds
) {}