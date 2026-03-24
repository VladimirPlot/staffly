package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamMode;

import java.util.List;

public record TrainingExamDto(
        Long id,
        Long restaurantId,
        String title,
        String description,
        Integer questionCount,
        Integer passPercent,
        Integer timeLimitSec,
        TrainingExamMode mode,
        Long knowledgeFolderId,
        Integer attemptLimit,
        Integer version,
        Boolean active,
        List<ExamSourceFolderDto> sourcesFolders,
        List<Long> sourceQuestionIds,
        List<Long> visibilityPositionIds
) {}
