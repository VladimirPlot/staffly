package ru.staffly.schedule.dto;

public record AddableScheduleMemberDto(
        Long memberId,
        String displayName,
        Long positionId,
        String positionName
) {
}
