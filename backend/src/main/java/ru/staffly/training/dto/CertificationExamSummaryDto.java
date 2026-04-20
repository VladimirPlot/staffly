package ru.staffly.training.dto;

public record CertificationExamSummaryDto(
        int totalAssigned,
        int passedCount,
        int failedCount,
        int inProgressCount,
        int notStartedCount,
        Double averageScore,
        Double passRate
) {
}