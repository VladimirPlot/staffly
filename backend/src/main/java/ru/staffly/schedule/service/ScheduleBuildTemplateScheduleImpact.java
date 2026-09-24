package ru.staffly.schedule.service;

import ru.staffly.schedule.model.ScheduleStatus;

/** Read-only identity and planned consequence for an authoritatively linked schedule. */
public record ScheduleBuildTemplateScheduleImpact(
        Long scheduleId,
        String scheduleTitle,
        ScheduleStatus status,
        ScheduleBuildTemplateScheduleAction action
) {
}
