package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamMode;

public record RuntimeExamDto(
        Long id,
        String title,
        Integer questionCount,
        Integer timeLimitSec,
        TrainingExamMode mode
) {}
