package ru.staffly.inventory.dto;

import java.time.Instant;

public record DishwareInventoryHistoryDto(Long id, Long actorId, String actorName, String action,
        String reason, Instant occurredAt, DishwareInventoryDto before, DishwareInventoryDto after) {}
