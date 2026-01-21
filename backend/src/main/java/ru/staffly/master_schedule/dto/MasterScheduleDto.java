package ru.staffly.master_schedule.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record MasterScheduleDto(
        Long id,
        Long restaurantId,
        String name,
        LocalDate periodStart,
        LocalDate periodEnd,
        BigDecimal plannedRevenue,
        List<MasterScheduleRowDto> rows,
        List<MasterScheduleCellDto> cells
) {}
