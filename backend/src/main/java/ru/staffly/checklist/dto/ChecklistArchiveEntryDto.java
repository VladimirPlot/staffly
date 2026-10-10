package ru.staffly.checklist.dto;

import java.util.Arrays;
import java.util.List;

/** A lightweight archive entry: no items, image URLs or historical periods. */
public record ChecklistArchiveEntryDto(Long checklistId, String name, String positions, boolean deleted, Long legacyHistoryId, List<String> positionNames) {
    public ChecklistArchiveEntryDto(Long checklistId, String name, String positions, boolean deleted, Long legacyHistoryId) {
        this(checklistId, name, positions, deleted, legacyHistoryId, positions == null || positions.isBlank() ? List.of()
                : Arrays.stream(positions.split(",")).map(String::trim).filter(value -> !value.isEmpty()).toList());
    }
}
