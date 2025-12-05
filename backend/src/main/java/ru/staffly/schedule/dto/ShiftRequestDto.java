package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleShiftRequestStatus;
import ru.staffly.schedule.model.ScheduleShiftRequestType;

import java.time.Instant;

public record ShiftRequestDto(
        Long id,
        ScheduleShiftRequestType type,
        String dayFrom,
        String dayTo,
        ScheduleShiftRequestStatus status,
        String reason,
        Instant createdAt,
        ShiftRequestMemberDto fromMember,
        ShiftRequestMemberDto toMember
) {
}