package ru.staffly.schedule.dto;

public record ScheduleRowDto(
        Long id,
        Long memberId,
        String displayName,
        Long positionId,
        String positionName
) {}