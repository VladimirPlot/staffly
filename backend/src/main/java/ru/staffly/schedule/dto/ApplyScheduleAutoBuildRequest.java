package ru.staffly.schedule.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotNull;

public record ApplyScheduleAutoBuildRequest(
        @JsonAlias("buildTemplateId") @NotNull Long templateId
) {
}
