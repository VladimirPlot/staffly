package ru.staffly.schedule.dto;

import java.util.List;
import java.util.Map;

public record ScheduleDto(
        Long id,
        String title,
        ScheduleConfigDto config,
        List<ScheduleDayDto> days,
        List<ScheduleRowDto> rows,
        Map<String, String> cellValues
) {}