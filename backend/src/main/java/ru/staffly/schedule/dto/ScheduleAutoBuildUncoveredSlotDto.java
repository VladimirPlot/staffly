package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleAutoBuildUncoveredSlotDto(
        String date,
        Long positionId,
        List<Long> positionIds,
        String positionName,
        String startTime,
        String endTime,
        int requiredCount,
        int assignedCount
) {
}
