package ru.staffly.training.dto;

public record CertificationEmployeeSummaryDto(
        Long userId,
        String fullName,
        Long positionId,
        String positionName,
        int assignedCount,
        int completedCount,
        int passedCount,
        int failedCount
) {
}
