package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MasterScheduleCopyWeekRequest(
        @NotNull LocalDate sourceWeekStart,
        @NotNull LocalDate targetWeekStart
) {}