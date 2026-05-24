package ru.staffly.training.dto;

import java.time.Instant;

public record CertificationExamAttemptHistoryDto(
        Long attemptId,
        Long assignmentId,
        Integer assignmentExamVersionSnapshot,
        Instant startedAt,
        Instant finishedAt,
        Integer scorePercent,
        Boolean passed,
        Integer examVersion
) {
}