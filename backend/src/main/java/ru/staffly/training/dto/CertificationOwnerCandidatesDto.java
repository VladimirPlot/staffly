package ru.staffly.training.dto;

import java.util.List;

public record CertificationOwnerCandidatesDto(
        Long examId,
        String title,
        Long currentOwnerUserId,
        String currentOwnerFullName,
        List<CertificationOwnerCandidateDto> candidates
) {
}