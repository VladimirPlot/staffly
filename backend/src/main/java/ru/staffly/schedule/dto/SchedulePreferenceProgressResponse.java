package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

public record SchedulePreferenceProgressResponse(
        Long scheduleId,
        String title,
        ScheduleStatus status,
        Instant preferenceDeadline,
        int totalParticipants,
        long submittedCount,
        long notSubmittedCount,
        List<SchedulePreferenceParticipantDto> participants
) {}
