package ru.staffly.training.dto;

public record CertificationExamPositionBreakdownDto(
        Long positionId,
        String positionName,
        int assignedCount,
        int passedCount,
        int failedCount,
        int inProgressCount,
        int notStartedCount,
        int exhaustedCount,
        Double averageScore,
        Double passRate
) {
}