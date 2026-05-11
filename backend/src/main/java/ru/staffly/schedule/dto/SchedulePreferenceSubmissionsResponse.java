package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

public record SchedulePreferenceSubmissionsResponse(
        Long scheduleId,
        String title,
        ScheduleStatus status,
        Instant preferenceDeadline,
        List<SchedulePreferenceSubmissionDto> submissions
) {}
