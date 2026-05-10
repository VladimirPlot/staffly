package ru.staffly.training.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CertificationOwnerBatchReassignmentRequest(
        @NotEmpty List<@Valid Item> items
) {
    public record Item(
            @NotNull Long examId,
            @NotNull Long newOwnerUserId
    ) {
    }
}