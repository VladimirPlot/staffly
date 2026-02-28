package ru.staffly.training.dto;

import java.util.List;

public record TrainingQuestionBlankDto(
        Long id,
        Integer index,
        List<TrainingQuestionBlankOptionDto> options
) {}