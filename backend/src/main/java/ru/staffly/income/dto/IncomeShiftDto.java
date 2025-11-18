package ru.staffly.income.dto;

import ru.staffly.income.model.IncomeShiftType;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

public record IncomeShiftDto(
        Long id,
        LocalDate date,
        IncomeShiftType type,
        BigDecimal fixedAmount,
        LocalTime startTime,
        LocalTime endTime,
        BigDecimal hourlyRate,
        BigDecimal tipsAmount,
        BigDecimal personalRevenue,
        String comment,
        BigDecimal hours,
        BigDecimal totalIncome,
        Instant createdAt,
        Instant updatedAt
) {
}