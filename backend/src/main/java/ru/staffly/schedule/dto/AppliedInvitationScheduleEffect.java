package ru.staffly.schedule.dto;

public record AppliedInvitationScheduleEffect(
        Long scheduleId,
        String scheduleTitle,
        Long ownerUserId
) {
}
