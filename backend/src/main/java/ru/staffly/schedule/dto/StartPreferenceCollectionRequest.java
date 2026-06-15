package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record StartPreferenceCollectionRequest(
        @NotNull Instant preferenceDeadline,
        Long buildTemplateId
) {}
