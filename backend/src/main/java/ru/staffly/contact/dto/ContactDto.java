package ru.staffly.contact.dto;

import java.time.Instant;

public record ContactDto(
        Long id,
        Long restaurantId,
        String name,
        String description,
        String phone,
        Instant createdAt,
        Instant updatedAt
) {
}