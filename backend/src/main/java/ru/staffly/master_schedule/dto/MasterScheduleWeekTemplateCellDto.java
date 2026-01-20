package ru.staffly.master_schedule.dto;

import java.math.BigDecimal;
import java.time.DayOfWeek;

public record MasterScheduleWeekTemplateCellDto(
        Long id,
        Long positionId,
        DayOfWeek weekday,
        Integer employeesCount,
        BigDecimal units
) {}
