package ru.staffly.schedule.dto;

import java.util.List;
import java.util.Map;

import ru.staffly.schedule.model.ScheduleCellSource;

public record SaveScheduleRequest(
        String title,
        ScheduleConfigDto config,
        List<ScheduleRowPayload> rows,
        Map<String, String> cellValues,
        Map<String, ScheduleCellSource> cellSources,
        Long ownerUserId
) {}
