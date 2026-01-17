package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import ru.staffly.master_schedule.model.MasterScheduleMode;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MasterScheduleCreateRequest(
        @NotBlank String name,
        @NotNull LocalDate periodStart,
        @NotNull LocalDate periodEnd,
        @NotNull MasterScheduleMode mode,
        BigDecimal plannedRevenue
) {}