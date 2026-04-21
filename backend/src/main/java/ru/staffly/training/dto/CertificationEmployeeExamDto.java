package ru.staffly.training.dto;

import java.time.Instant;

public record CertificationEmployeeExamDto(
        Long examId,
        String examTitle,
        CertificationAnalyticsStatus status,
        Integer bestScore,
        Instant lastAttemptAt,
        Integer attemptsUsed,
        Integer attemptsAllowed
) {
}
