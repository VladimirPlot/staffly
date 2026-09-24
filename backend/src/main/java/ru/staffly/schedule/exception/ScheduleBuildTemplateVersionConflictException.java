package ru.staffly.schedule.exception;

import java.util.LinkedHashMap;
import java.util.Map;

public class ScheduleBuildTemplateVersionConflictException extends RuntimeException {
    public static final String ERROR_CODE = "SCHEDULE_BUILD_TEMPLATE_VERSION_CONFLICT";
    private final Map<String, Object> meta;

    public ScheduleBuildTemplateVersionConflictException(Long expectedVersion, Long actualVersion) {
        super("Шаблон был изменён. Обновите данные и повторите действие.");
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("expectedVersion", expectedVersion);
        values.put("actualVersion", actualVersion);
        this.meta = values;
    }

    public Map<String, Object> getMeta() { return meta; }
}
