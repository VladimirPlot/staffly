package ru.staffly.schedule.model;

public enum ScheduleAuditAction {
    CREATED,
    UPDATED,
    DELETED,
    OWNER_CHANGED,
    SHIFT_REQUEST_CREATED,
    SHIFT_REQUEST_APPROVED,
    SHIFT_REQUEST_REJECTED,
    SHIFT_REQUEST_AUTO_REJECTED
}