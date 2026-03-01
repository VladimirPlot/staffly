package ru.staffly.training.repository.projection;

import ru.staffly.training.model.TrainingExamMode;

public interface TrainingExamUsageProjection {
    Long getId();
    String getTitle();
    TrainingExamMode getMode();
    Long getKnowledgeFolderId();
}