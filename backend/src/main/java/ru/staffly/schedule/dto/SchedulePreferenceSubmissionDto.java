package ru.staffly.schedule.dto;

import java.time.Instant;
import java.util.List;

public record SchedulePreferenceSubmissionDto(
        Long submissionId,
        SchedulePreferenceMemberDto member,
        Long positionId,
        String positionName,
        Instant submittedAt,
        Instant updatedAt,
        int revision,
        String comment,
        List<SchedulePreferenceCellDto> cells
) {}
