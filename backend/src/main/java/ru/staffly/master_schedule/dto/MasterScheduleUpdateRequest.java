package ru.staffly.master_schedule.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MasterScheduleUpdateRequest(
        String name,
        LocalDate periodStart,
        LocalDate periodEnd,
        BigDecimal plannedRevenue
) {}
