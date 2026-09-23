package ru.staffly.member.dto;

/** Mutations observed while applying a position change (never plan predictions). */
public enum PositionChangeScheduleEffectType {
    OLD_PARTICIPATION_REMOVED,
    PREFERENCE_SUBMISSION_REMOVED,
    NEW_PARTICIPATION_CREATED,
    COLLECTION_REOPENED,
    AUTO_BUILD_RESULT_INVALIDATED,
    DRAFT_EMPLOYEE_REMOVED,
    PUBLISHED_FUTURE_SHIFTS_CANCELLED
}
