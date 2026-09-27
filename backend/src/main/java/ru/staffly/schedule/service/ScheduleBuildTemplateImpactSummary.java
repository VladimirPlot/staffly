package ru.staffly.schedule.service;

import java.util.List;

/** Counts derived exclusively from the per-schedule impact items. */
public record ScheduleBuildTemplateImpactSummary(
        int linkedScheduleCount,
        int noActionCount,
        int keepPreferencesCount,
        int invalidateAppliedAutoBuildCount,
        int resetPreferenceCollectionCount,
        int publishedUnchangedCount
) {
    public static ScheduleBuildTemplateImpactSummary from(List<ScheduleBuildTemplateScheduleImpact> schedules) {
        return new ScheduleBuildTemplateImpactSummary(
                schedules.size(),
                count(schedules, ScheduleBuildTemplateScheduleAction.NO_ACTION),
                count(schedules, ScheduleBuildTemplateScheduleAction.KEEP_PREFERENCES),
                count(schedules, ScheduleBuildTemplateScheduleAction.INVALIDATE_APPLIED_AUTO_BUILD),
                count(schedules, ScheduleBuildTemplateScheduleAction.RESET_PREFERENCE_COLLECTION),
                count(schedules, ScheduleBuildTemplateScheduleAction.PUBLISHED_UNCHANGED)
        );
    }

    private static int count(List<ScheduleBuildTemplateScheduleImpact> schedules,
                             ScheduleBuildTemplateScheduleAction action) {
        return (int) schedules.stream().filter(schedule -> schedule.action() == action).count();
    }
}
