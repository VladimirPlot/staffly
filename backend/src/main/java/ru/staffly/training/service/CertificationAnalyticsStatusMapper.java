package ru.staffly.training.service;

import ru.staffly.training.dto.CertificationAnalyticsStatus;
import ru.staffly.training.model.TrainingExamAssignmentStatus;

final class CertificationAnalyticsStatusMapper {
    private CertificationAnalyticsStatusMapper() {
    }

    static CertificationAnalyticsStatus fromLifecycle(TrainingExamAssignmentStatus lifecycleStatus) {
        if (lifecycleStatus == null) {
            return CertificationAnalyticsStatus.NOT_STARTED;
        }
        return switch (lifecycleStatus) {
            case ASSIGNED, ARCHIVED -> CertificationAnalyticsStatus.NOT_STARTED;
            case IN_PROGRESS -> CertificationAnalyticsStatus.IN_PROGRESS;
            case PASSED -> CertificationAnalyticsStatus.PASSED;
            case FAILED, EXHAUSTED -> CertificationAnalyticsStatus.FAILED;
        };
    }
}