package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotNull;
import ru.staffly.master_schedule.model.SalaryHandling;

import java.math.BigDecimal;

public record MasterScheduleRowCreateRequest(
        @NotNull Long positionId,
        SalaryHandling salaryHandling,
        BigDecimal rateOverride,
        BigDecimal amountOverride
) {}