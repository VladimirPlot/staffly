package ru.staffly.training.dto;

public record CertificationExamSummaryPreviewDto(
        Integer totalAssigned,
        Integer passedCount,
        Integer failedCount,
        Integer inProgressCount,
        Integer notStartedCount,
        Integer completedCount
) {
}