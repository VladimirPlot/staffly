package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.model.PreferenceCollectionMode;

import java.time.Instant;
import java.util.List;

public record SchedulePreferenceMyResponse(
        Long scheduleId,
        String title,
        String startDate,
        String endDate,
        List<ScheduleDayDto> days,
        ScheduleStatus status,
        PreferenceCollectionMode preferenceCollectionMode,
        Instant preferenceDeadline,
        boolean canSubmit,
        Instant submittedAt,
        Instant updatedAt,
        int revision,
        SchedulePreferenceMemberDto member,
        List<SchedulePreferenceAllowedShiftOptionDto> allowedShiftOptions,
        List<SchedulePreferenceCellDto> cells,
        String periodComment
) {}
