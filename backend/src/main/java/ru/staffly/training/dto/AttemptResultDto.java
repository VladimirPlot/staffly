package ru.staffly.training.dto;

import java.time.Instant;
import java.util.List;

public record AttemptResultDto(
        Long id,
        Long examId,
        Long userId,
        Instant startedAt,
        Instant finishedAt,
        Integer scorePercent,
        Boolean passed,
        List<AttemptResultQuestionDto> questions
) {}
