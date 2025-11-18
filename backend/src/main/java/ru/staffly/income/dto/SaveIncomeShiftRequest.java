package ru.staffly.income.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import ru.staffly.income.model.IncomeShiftType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

public record SaveIncomeShiftRequest(
        @NotNull(message = "Дата смены обязательна")
        LocalDate date,

        @NotNull(message = "Тип смены обязателен")
        IncomeShiftType type,

        @Positive(message = "Оплата за смену должна быть больше 0")
        BigDecimal fixedAmount,

        LocalTime startTime,

        LocalTime endTime,

        @DecimalMin(value = "0.01", message = "Ставка должна быть больше 0")
        BigDecimal hourlyRate,

        @DecimalMin(value = "0", message = "Чаевые не могут быть отрицательными")
        BigDecimal tipsAmount,

        @DecimalMin(value = "0", message = "Личная выручка не может быть отрицательной")
        BigDecimal personalRevenue,

        @Size(max = 4000)
        String comment
) {
}