package ru.staffly.notification.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record NotificationDto(
        Long id,
        Long restaurantId,
        String content,
        LocalDate expiresAt,
        Instant createdAt,
        Instant updatedAt,
        NotificationAuthorDto createdBy,
        List<NotificationPositionDto> positions
) {}