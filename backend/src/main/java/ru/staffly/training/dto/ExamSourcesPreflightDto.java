package ru.staffly.training.dto;

import java.util.List;

public record ExamSourcesPreflightDto(
        int availableQuestionCount,
        boolean valid,
        List<String> issues,
        List<String> folderVisibilityWarnings
) {
    public ExamSourcesPreflightDto(int availableQuestionCount, boolean valid, List<String> issues) {
        this(availableQuestionCount, valid, issues, List.of());
    }
}
