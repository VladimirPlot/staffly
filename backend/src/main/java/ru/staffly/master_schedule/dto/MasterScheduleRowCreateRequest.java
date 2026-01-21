package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotNull;
import ru.staffly.master_schedule.model.PayType;
import java.math.BigDecimal;

public record MasterScheduleRowCreateRequest(
        @NotNull Long positionId,
        BigDecimal rateOverride,
        BigDecimal amountOverride,
        PayType payTypeOverride
) {}
