package ru.staffly.schedule.dto;

public record ScheduleAutoBuildUncoveredSlotDto(
        String date,
        Long positionId,
        String startTime,
        String endTime,
        int requiredCount,
        int assignedCount
) {
}
