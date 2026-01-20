package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.DayOfWeek;

public record MasterScheduleWeekTemplateCellUpdateRequest(
        @NotNull Long positionId,
        @NotNull DayOfWeek weekday,
        Integer employeesCount,
        BigDecimal units
) {}
