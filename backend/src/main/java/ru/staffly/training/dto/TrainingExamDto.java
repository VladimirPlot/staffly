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
        Long folderId,
        Integer attemptLimit,
        Integer version,
        Integer sortOrder,
        Boolean active,
        List<ExamSourceFolderDto> sourcesFolders,
        List<Long> sourceQuestionIds,
        List<Long> visibilityPositionIds,
        Long createdByUserId,
        String createdByFullName,
        Long ownerUserId,
        String ownerFullName,
        CertificationExamSummaryPreviewDto certificationSummaryPreview
) {}
