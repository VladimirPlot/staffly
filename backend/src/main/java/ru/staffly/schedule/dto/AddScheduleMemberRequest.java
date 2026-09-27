package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record AddScheduleMemberRequest(@NotNull Long version, @NotNull Long memberId) {
}
