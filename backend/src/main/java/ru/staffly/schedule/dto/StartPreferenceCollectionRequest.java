package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;
import ru.staffly.schedule.model.PreferenceCollectionMode;

import java.time.Instant;

public record StartPreferenceCollectionRequest(
        @NotNull Long version,
        @NotNull Instant preferenceDeadline,
        @NotNull PreferenceCollectionMode mode,
        Long buildTemplateId
) {}
