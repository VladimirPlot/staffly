package ru.staffly.training.dto;

public record CertificationExamPositionBreakdownDto(
        Long positionId,
        String positionName,
        int assignedCount,
        int passedCount,
        int failedCount,
        int inProgressCount,
        int notStartedCount,
        Double averageScore,
        Double passRate
) {
}