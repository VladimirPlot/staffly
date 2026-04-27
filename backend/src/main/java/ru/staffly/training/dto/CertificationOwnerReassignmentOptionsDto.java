package ru.staffly.training.dto;

import java.util.List;

public record CertificationOwnerReassignmentOptionsDto(
        Long userId,
        String fullName,
        List<OwnedCertificationExamDto> ownedExams
) {
}