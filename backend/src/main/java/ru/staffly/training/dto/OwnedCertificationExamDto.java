package ru.staffly.training.dto;

import java.util.List;

public record OwnedCertificationExamDto(
        Long examId,
        String title,
        List<Long> visibilityPositionIds,
        List<String> visibilityPositionNames,
        List<CertificationOwnerCandidateDto> candidates
) {
}