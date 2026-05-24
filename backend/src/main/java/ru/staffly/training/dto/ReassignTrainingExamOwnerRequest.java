package ru.staffly.training.dto;

import jakarta.validation.constraints.NotNull;

public record ReassignTrainingExamOwnerRequest(
        @NotNull Long ownerUserId
) {
}