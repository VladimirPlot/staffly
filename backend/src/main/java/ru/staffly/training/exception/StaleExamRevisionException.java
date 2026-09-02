package ru.staffly.training.exception;

import ru.staffly.common.exception.ConflictException;

import java.util.Map;

public class StaleExamRevisionException extends ConflictException {
    public static final String ERROR_CODE = "STALE_EXAM_REVISION";

    public StaleExamRevisionException(Long examId, Long currentEditorRevision) {
        super(
                "Аттестация была изменена другим пользователем. Обновите данные и повторите изменения.",
                Map.of("examId", examId, "currentEditorRevision", currentEditorRevision)
        );
    }
}
