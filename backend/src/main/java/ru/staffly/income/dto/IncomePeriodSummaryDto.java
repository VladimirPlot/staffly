package ru.staffly.income.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record IncomePeriodSummaryDto(
        Long id,
        String name,
        String description,
        long shiftCount,
        BigDecimal totalHours,
        BigDecimal totalIncome,
        BigDecimal totalTips,
        BigDecimal totalPersonalRevenue,
        Instant createdAt,
        Instant updatedAt
) {
}