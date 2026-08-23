package ru.staffly.training.dto;

public record CertificationContainerCapabilitiesDto(
        boolean folderReorderAllowed,
        boolean certificationExamReorderAllowed
) {
}
