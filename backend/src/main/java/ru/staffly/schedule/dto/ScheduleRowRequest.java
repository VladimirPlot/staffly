package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record ScheduleRowRequest(@NotNull Long memberId) {
}
