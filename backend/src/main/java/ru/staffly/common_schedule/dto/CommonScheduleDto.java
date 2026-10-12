package ru.staffly.common_schedule.dto;

import java.util.List;
import ru.staffly.schedule.dto.ScheduleContentDto;

public record CommonScheduleDto(CommonScheduleSummaryDto summary, List<Source> sources) {
    public record Source(Long id, Long version, String title, ScheduleContentDto content) {}
}
