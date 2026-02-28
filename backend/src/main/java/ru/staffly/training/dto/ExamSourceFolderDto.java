package ru.staffly.training.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingExamSourcePickMode;

public record ExamSourceFolderDto(
        @NotNull Long folderId,
        @NotNull TrainingExamSourcePickMode pickMode,
        @Min(1) Integer randomCount
) {}
