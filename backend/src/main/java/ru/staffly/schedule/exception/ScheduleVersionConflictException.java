package ru.staffly.schedule.exception;

import ru.staffly.common.exception.ConflictException;

import java.util.Map;
import java.util.HashMap;

public class ScheduleVersionConflictException extends ConflictException {
    public static final String ERROR_CODE = "SCHEDULE_VERSION_CONFLICT";
    public static final String MESSAGE =
            "График был изменён другим пользователем. Обновите данные и повторите действие.";

    public ScheduleVersionConflictException(Long expectedVersion, Long actualVersion) {
        super(MESSAGE, versionMeta(expectedVersion, actualVersion));
    }

    public ScheduleVersionConflictException() {
        super(MESSAGE);
    }

    private static Map<String, Object> versionMeta(Long expectedVersion, Long actualVersion) {
        Map<String, Object> meta = new HashMap<>();
        meta.put("expectedVersion", expectedVersion);
        meta.put("actualVersion", actualVersion);
        return meta;
    }
}
