package ru.staffly.training.dto;

import java.util.List;

public record QuestionBankTreeNodeDto(
        Long id,
        Long parentId,
        String name,
        boolean active,
        Integer sortOrder,
        long questionCount,
        List<QuestionBankTreeNodeDto> children
) {}
