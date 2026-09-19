package ru.staffly.member.dto;

import jakarta.validation.constraints.NotNull;

public record PositionChangeImpactRequest(@NotNull Long targetPositionId) {
}
