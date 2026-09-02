package ru.staffly.training.exception;

import ru.staffly.common.exception.ConflictException;

import java.util.LinkedHashMap;
import java.util.List;

public class MaterialChangeRequiresNewCycleException extends ConflictException {
    public static final String ERROR_CODE = "MATERIAL_CHANGE_REQUIRES_NEW_CYCLE";

    public MaterialChangeRequiresNewCycleException(Long examId, int currentVersion, List<String> changedFields) {
        super("Изменение вопросов или правил аттестации требует нового цикла.", metadata(examId, currentVersion, changedFields));
    }

    private static LinkedHashMap<String, Object> metadata(Long examId, int currentVersion, List<String> changedFields) {
        var metadata = new LinkedHashMap<String, Object>();
        metadata.put("examId", examId);
        metadata.put("currentVersion", currentVersion);
        metadata.put("proposedVersion", currentVersion + 1);
        metadata.put("changedFields", changedFields);
        return metadata;
    }
}
