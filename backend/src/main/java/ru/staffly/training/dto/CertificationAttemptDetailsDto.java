package ru.staffly.training.dto;

import java.time.Instant;
import java.util.List;

public record CertificationAttemptDetailsDto(
        Long attemptId,
        Long examId,
        String examTitle,
        String examDescription,
        Long userId,
        String userFullName,
        Long assignmentId,
        Integer examVersion,
        Instant startedAt,
        Instant finishedAt,
        Integer scorePercent,
        int passPercent,
        boolean passed,
        Integer questionCount,
        Long durationSec,
        List<CertificationAttemptDetailsQuestionDto> questions
) {
}
