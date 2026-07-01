package ru.staffly.schedule.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;

public record PreviewScheduleAutoBuildRequest(
        @JsonAlias("buildTemplateId") @NotNull Long templateId
) {
}
