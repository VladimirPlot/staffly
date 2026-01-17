package ru.staffly.master_schedule.dto;

import ru.staffly.master_schedule.model.PayType;
import ru.staffly.master_schedule.model.SalaryHandling;

import java.math.BigDecimal;

public record MasterScheduleRowDto(
        Long id,
        Long positionId,
        String positionName,
        int rowIndex,
        SalaryHandling salaryHandling,
        BigDecimal rateOverride,
        BigDecimal amountOverride,
        PayType payType,
        BigDecimal payRate,
        Integer normHours
) {}