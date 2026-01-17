package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record MasterScheduleCellUpdateRequest(
        @NotNull Long rowId,
        @NotNull LocalDate workDate,
        String valueRaw
) {}