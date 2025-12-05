package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record ShiftDecisionRequest(@NotNull Boolean accepted) {
}