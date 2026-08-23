package ru.staffly.training.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingExamMode;

import java.util.List;

public record ExamSourcesPreflightRequest(
        @NotNull TrainingExamMode mode,
        @Min(1) Integer questionCount,
        List<ExamSourceFolderDto> sourcesFolders,
        List<Long> sourceQuestionIds
) {}
