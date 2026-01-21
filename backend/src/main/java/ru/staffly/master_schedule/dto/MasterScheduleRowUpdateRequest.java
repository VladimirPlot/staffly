package ru.staffly.master_schedule.dto;

import ru.staffly.master_schedule.model.PayType;
import java.math.BigDecimal;

public record MasterScheduleRowUpdateRequest(
        BigDecimal rateOverride,
        BigDecimal amountOverride,
        PayType payTypeOverride
) {}
