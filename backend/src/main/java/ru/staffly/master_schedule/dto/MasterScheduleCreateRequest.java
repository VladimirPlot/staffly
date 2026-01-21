package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MasterScheduleCreateRequest(
        @NotBlank String name,
        @NotNull LocalDate periodStart,
        @NotNull LocalDate periodEnd,
        BigDecimal plannedRevenue
) {}
