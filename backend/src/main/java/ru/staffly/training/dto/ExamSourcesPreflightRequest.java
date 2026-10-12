package ru.staffly.training.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingExamMode;

import java.util.List;

public record ExamSourcesPreflightRequest(
        @NotNull TrainingExamMode mode,
        @Min(1) Integer questionCount,
        List<ExamSourceFolderDto> sourcesFolders,
        List<Long> sourceQuestionIds,
        Long knowledgeFolderId,
        Long folderId,
        List<Long> visibilityPositionIds
) {
    public ExamSourcesPreflightRequest(TrainingExamMode mode, Integer questionCount,
            List<ExamSourceFolderDto> sourcesFolders, List<Long> sourceQuestionIds) {
        this(mode, questionCount, sourcesFolders, sourceQuestionIds, null, null, null);
    }
}
