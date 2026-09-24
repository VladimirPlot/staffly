package ru.staffly.schedule.service;

import java.util.List;

/** Immutable dry-run result for a proposed build-template update. */
public record ScheduleBuildTemplateImpactPlan(
        ScheduleBuildTemplateChangeImpact impact,
        List<ScheduleBuildTemplateScheduleImpact> schedules
) {
    public ScheduleBuildTemplateImpactPlan {
        schedules = List.copyOf(schedules);
    }

    public ScheduleBuildTemplateImpactSummary summary() {
        return ScheduleBuildTemplateImpactSummary.from(schedules);
    }

    public boolean hasDestructiveConsequences() {
        return schedules.stream().anyMatch(schedule ->
                schedule.action() == ScheduleBuildTemplateScheduleAction.INVALIDATE_APPLIED_AUTO_BUILD
                        || schedule.action() == ScheduleBuildTemplateScheduleAction.RESET_PREFERENCE_COLLECTION);
    }
}
