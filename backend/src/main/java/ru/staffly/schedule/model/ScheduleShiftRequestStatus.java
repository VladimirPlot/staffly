package ru.staffly.schedule.model;

public enum ScheduleShiftRequestStatus {
    PENDING_TARGET,
    PENDING_MANAGER,
    APPROVED,
    REJECTED_BY_TARGET,
    REJECTED_BY_MANAGER,
    CANCELLED
}