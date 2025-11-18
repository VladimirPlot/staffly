package ru.staffly.income.dto;

import java.util.List;

public record IncomePeriodDetailDto(
        IncomePeriodSummaryDto period,
        List<IncomeShiftDto> shifts
) {
}