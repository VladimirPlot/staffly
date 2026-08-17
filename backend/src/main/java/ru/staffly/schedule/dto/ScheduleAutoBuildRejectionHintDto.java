package ru.staffly.schedule.dto;

public record ScheduleAutoBuildRejectionHintDto(
        Long memberId,
        String memberName,
        String date,
        Long positionConfigId,
        String positionName,
        Long shiftOptionId,
        String shiftLabel,
        String startTime,
        String endTime,
        String reason,
        String message
) {
}
