package ru.staffly.training.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import ru.staffly.training.model.TrainingFolderType;

import java.util.List;

public record ReorderTrainingObjectsRequest(
        @NotNull TrainingFolderType type,
        Long folderId,
        @Valid List<ObjectOrder> objects
) {
    public record ObjectOrder(
            @NotBlank String kind,
            @NotNull Long id,
            @NotNull Integer sortOrder
    ) {}
}
