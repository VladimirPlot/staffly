package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamAssignmentStatus;

import java.time.Instant;
import java.util.List;

public record CertificationMyResultDto(
        Long examId,
        String title,
        String description,
        TrainingExamAssignmentStatus assignmentStatus,
        Integer scorePercent,
        int passPercent,
        int attemptsUsed,
        Integer attemptsAllowed,
        Integer bestScore,
        Instant lastAttemptAt,
        Instant passedAt,
        List<CertificationMyResultQuestionDto> questions
) {
}