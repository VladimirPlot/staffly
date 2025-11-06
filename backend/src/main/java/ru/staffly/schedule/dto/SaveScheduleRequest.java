package ru.staffly.schedule.dto;

import java.util.List;
import java.util.Map;

public record SaveScheduleRequest(
        String title,
        ScheduleConfigDto config,
        List<ScheduleRowPayload> rows,
        Map<String, String> cellValues
) {}