package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleCellSource;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record ScheduleDto(
        Long id,
        String title,
        ScheduleConfigDto config,
        List<ScheduleDayDto> days,
        List<ScheduleRowDto> rows,
        Map<String, String> cellValues,
        Map<String, ScheduleCellSource> cellSources,
        ScheduleOwnerDto owner,
        ScheduleCreatedByDto createdBy,
        List<ScheduleAuditLogDto> history,
        ScheduleStatus status,
        Instant preferenceCollectionStartedAt,
        Instant preferenceDeadline,
        Instant preferenceClosedAt,
        Instant preferenceAppliedAt
) {}
