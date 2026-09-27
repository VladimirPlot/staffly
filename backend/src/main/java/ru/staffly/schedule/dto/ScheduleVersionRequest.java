package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record ScheduleVersionRequest(@NotNull Long version) {
}
