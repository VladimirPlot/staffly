package ru.staffly.schedule.dto;

public record ScheduleRowPayload(
        Long memberId,
        String displayName,
        Long positionId,
        String positionName
) {}