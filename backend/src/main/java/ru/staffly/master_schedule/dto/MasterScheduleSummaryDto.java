package ru.staffly.master_schedule.dto;

import ru.staffly.master_schedule.model.MasterScheduleMode;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MasterScheduleSummaryDto(
        Long id,
        Long restaurantId,
        String name,
        LocalDate periodStart,
        LocalDate periodEnd,
        MasterScheduleMode mode,
        BigDecimal plannedRevenue
) {}