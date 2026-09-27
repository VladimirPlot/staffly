package ru.staffly.schedule.service;

/** Business impact of an effective build-template update, ordered by severity. */
public enum ScheduleBuildTemplateChangeImpact {
    NONE,
    NEUTRAL_METADATA,
    PLANNER_AFFECTING,
    PREFERENCE_AFFECTING;

    public ScheduleBuildTemplateChangeImpact combine(ScheduleBuildTemplateChangeImpact other) {
        return ordinal() >= other.ordinal() ? this : other;
    }
}
