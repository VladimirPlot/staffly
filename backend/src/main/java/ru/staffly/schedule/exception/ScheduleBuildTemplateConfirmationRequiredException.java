package ru.staffly.schedule.exception;

import ru.staffly.schedule.service.ScheduleBuildTemplateImpactPlan;

import java.util.LinkedHashMap;
import java.util.Map;

public class ScheduleBuildTemplateConfirmationRequiredException extends RuntimeException {
    public static final String ERROR_CODE = "SCHEDULE_BUILD_TEMPLATE_CHANGE_CONFIRMATION_REQUIRED";
    private final Map<String, Object> meta;

    public ScheduleBuildTemplateConfirmationRequiredException(ScheduleBuildTemplateImpactPlan plan) {
        super("Изменение шаблона сбросит данные связанных графиков и требует подтверждения.");
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("impact", plan.impact());
        values.put("schedules", plan.schedules());
        values.put("summary", plan.summary());
        values.put("hasDestructiveConsequences", plan.hasDestructiveConsequences());
        this.meta = values;
    }

    public Map<String, Object> getMeta() { return meta; }
}
