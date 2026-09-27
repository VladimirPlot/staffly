package ru.staffly.schedule.dto;

import java.time.Instant;
import java.util.List;

public record ScheduleBuildTemplateDto(
        Long id,
        Long version,
        String name,
        String description,
        boolean isActive,
        Instant createdAt,
        Instant updatedAt,
        List<ScheduleBuildPositionConfigDto> positionConfigs
) {}
