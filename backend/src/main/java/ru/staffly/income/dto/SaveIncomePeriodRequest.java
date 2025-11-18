package ru.staffly.income.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SaveIncomePeriodRequest(
        @NotBlank(message = "Название периода обязательно")
        @Size(max = 255)
        String name,

        @Size(max = 4000)
        String description
) {
}