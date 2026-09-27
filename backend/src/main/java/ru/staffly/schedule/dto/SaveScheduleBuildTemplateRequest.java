package ru.staffly.schedule.dto;

import java.util.List;

public record SaveScheduleBuildTemplateRequest(
        String name,
        String description,
        Boolean isActive,
        List<SaveScheduleBuildPositionConfigRequest> positionConfigs,
        Long expectedVersion,
        Boolean confirmConsequences
) {
    public SaveScheduleBuildTemplateRequest(String name, String description, Boolean isActive,
                                            List<SaveScheduleBuildPositionConfigRequest> positionConfigs) {
        this(name, description, isActive, positionConfigs, null, false);
    }

    public boolean consequencesConfirmed() {
        return Boolean.TRUE.equals(confirmConsequences);
    }
}
