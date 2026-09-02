package ru.staffly.training.dto;

import java.util.List;

public record ExamSourcesPreflightDto(
        int availableQuestionCount,
        boolean valid,
        List<String> issues
) {}
