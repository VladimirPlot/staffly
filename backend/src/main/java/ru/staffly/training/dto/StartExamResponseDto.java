package ru.staffly.training.dto;

import java.time.Instant;
import java.util.List;

public record StartExamResponseDto(
        Long attemptId,
        Instant startedAt,
        Integer examVersion,
        TrainingExamDto exam,
        List<AttemptQuestionSnapshotDto> questions
) {}
