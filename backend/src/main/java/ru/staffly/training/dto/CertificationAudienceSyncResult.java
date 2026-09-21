package ru.staffly.training.dto;

import ru.staffly.training.model.TrainingExamAssignment;

import java.util.List;

public record CertificationAudienceSyncResult(
        List<TrainingExamAssignment> createdAssignments,
        List<AppliedCertificationAudienceEffect> effects
) {
    public CertificationAudienceSyncResult {
        createdAssignments = List.copyOf(createdAssignments);
        effects = List.copyOf(effects);
    }
}
