package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingQuestionType;

import java.util.List;

public record AttemptQuestionSnapshotDto(
        Long questionId,
        TrainingQuestionType type,
        String prompt,
        String explanation,
        List<TrainingQuestionOptionViewDto> options,
        List<TrainingQuestionMatchPairViewDto> matchPairs
) {}
