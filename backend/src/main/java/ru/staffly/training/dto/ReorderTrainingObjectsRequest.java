package ru.staffly.training.dto;

import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.model.TrainingObjectKind;
import ru.staffly.training.model.TrainingQuestionGroup;

import java.util.List;

/** Reorders one kind of object without changing its container. */
public record ReorderTrainingObjectsRequest(
        @NotNull TrainingFolderType type,
        Long folderId,
        @NotNull TrainingObjectKind kind,
        TrainingQuestionGroup questionGroup,
        @NotNull List<@NotNull Long> orderedIds
) {}
