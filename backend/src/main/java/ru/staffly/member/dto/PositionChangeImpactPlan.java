package ru.staffly.member.dto;

import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

/** Authoritative, read-only preview consumed by the later atomic position-change command. */
public record PositionChangeImpactPlan(
        Instant calculatedAt,
        Employee employee,
        List<OldPositionImpact> oldPositionImpacts,
        List<NewPositionOpportunity> newPositionOpportunities
) {
    public record Position(Long id, String name) { }

    public record Employee(Long memberId, String name, Position oldPosition, Position newPosition,
                           Instant memberCreatedAt) { }

    public record OldPositionImpact(
            Long scheduleId, String scheduleTitle, ScheduleStatus scheduleStatus, Long scheduleVersion,
            Long participationId, boolean participationWillBeRemoved,
            Long preferenceSubmissionId, Integer preferenceSubmissionRevision,
            boolean preferenceDataWillBeDeleted, boolean progressDenominatorWillChange,
            boolean appliedDraftWillBeInvalidated, boolean activeRowWillBeRemoved,
            boolean publishedRowBecomesHistorical, PublishedShiftImpact publishedShiftImpact
    ) { }

    public record PublishedShiftImpact(int elapsedPreserved, int currentPreserved,
                                       int futureToCancel, int legacyUnstructuredPreserved) { }

    public record NewPositionOpportunity(
            Long scheduleId, String scheduleTitle, ScheduleStatus scheduleStatus, Long scheduleVersion,
            List<Action> allowedActions, Instant currentPreferenceDeadline, boolean lessThanSixHoursRemain,
            PreferenceCollectionMode preferenceMode, boolean newPositionEligible,
            boolean frozenShiftOptionsRequired, boolean frozenShiftOptionsAvailable,
            Long preferenceBuildTemplateId, List<Long> applicableFrozenShiftOptionSnapshotIds,
            long preferenceCollectionCycle, List<EligibilityProblem> eligibilityProblems,
            boolean newDeadlineRequiredForReopen
    ) { }

    public enum Action {
        ADD_TO_COLLECTION,
        DO_NOT_ADD,
        CHANGE_POSITION_AND_REOPEN_COLLECTION,
        CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE,
        REOPEN_AND_REBUILD_PREFERENCE_FLOW,
        INFORMATION_ONLY
    }

    public enum EligibilityProblem {
        MISSING_PREFERENCE_MODE,
        MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION
    }
}
