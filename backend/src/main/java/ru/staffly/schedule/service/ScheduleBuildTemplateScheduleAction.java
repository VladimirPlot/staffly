package ru.staffly.schedule.service;

/** Consequence that a later confirmed template update would have for one linked schedule. */
public enum ScheduleBuildTemplateScheduleAction {
    NO_ACTION,
    KEEP_PREFERENCES,
    INVALIDATE_APPLIED_AUTO_BUILD,
    RESET_PREFERENCE_COLLECTION,
    PUBLISHED_UNCHANGED
}
