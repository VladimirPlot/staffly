package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MasterScheduleCopyDayRequest(
        @NotNull LocalDate sourceDate,
        @NotNull LocalDate targetDate
) {}