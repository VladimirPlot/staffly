package ru.staffly.schedule.dto;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record ReassignScheduleOwnersRequest(
        @NotNull Map<Long, Long> ownerUserIdsByScheduleId
) {}