package ru.staffly.schedule.dto;

import java.util.List;

public record SaveScheduleBuildTemplateRequest(
        String name,
        String description,
        Boolean isActive,
        List<SaveScheduleBuildPositionConfigRequest> positionConfigs
) {}
