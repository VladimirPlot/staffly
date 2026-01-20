package ru.staffly.master_schedule.dto;

import ru.staffly.master_schedule.model.PayType;
import ru.staffly.master_schedule.model.SalaryHandling;

import java.math.BigDecimal;

public record MasterScheduleRowUpdateRequest(
        SalaryHandling salaryHandling,
        BigDecimal rateOverride,
        BigDecimal amountOverride,
        PayType payTypeOverride
) {}
