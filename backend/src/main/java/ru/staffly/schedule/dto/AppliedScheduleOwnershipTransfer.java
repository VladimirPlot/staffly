package ru.staffly.schedule.dto;

/** A schedule ownership change that has been validated and persisted in the current transaction. */
public record AppliedScheduleOwnershipTransfer(
        Long scheduleId,
        String title,
        Long newOwnerUserId
) {
}
