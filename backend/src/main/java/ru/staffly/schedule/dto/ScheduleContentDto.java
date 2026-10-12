package ru.staffly.schedule.dto;

import java.util.List;
import java.util.Map;
import ru.staffly.schedule.model.ScheduleCellSource;

/** Read-only schedule content; contains no lifecycle, audit, owner or request data. */
public record ScheduleContentDto(ScheduleConfigDto config, List<ScheduleDayDto> days,
        List<ScheduleRowDto> rows, Map<String, String> cellValues,
        Map<String, ScheduleCellSource> cellSources, Map<String, ScheduleCellShiftDto> cellShifts) {}
