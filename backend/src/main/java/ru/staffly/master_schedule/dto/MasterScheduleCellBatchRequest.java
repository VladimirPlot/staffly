package ru.staffly.master_schedule.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record MasterScheduleCellBatchRequest(
        @NotEmpty List<MasterScheduleCellUpdateRequest> items
) {}