package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

public record ChangeScheduleOwnerRequest(
        @NotNull Long ownerUserId
) {}