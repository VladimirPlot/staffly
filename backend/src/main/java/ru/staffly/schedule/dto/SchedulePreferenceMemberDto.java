package ru.staffly.schedule.dto;

public record SchedulePreferenceMemberDto(
        Long memberId,
        Long userId,
        String displayName,
        Long positionId,
        String positionName
) {}
