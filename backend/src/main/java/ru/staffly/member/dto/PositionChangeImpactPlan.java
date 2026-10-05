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
        List<NewPositionOpportunity> newPositionOpportunities,
        PositionSnapshot currentPositionSnapshot,
        PositionSnapshot targetPositionSnapshot,
        List<OwnershipState> scheduleOwnershipState,
        List<OwnershipState> certificationOwnershipState,
        List<ru.staffly.member.dto.EmployeeRemovalImpactPlan.OwnershipResource> scheduleOwnership,
        List<ru.staffly.member.dto.EmployeeRemovalImpactPlan.OwnershipResource> certificationOwnership,
        List<ru.staffly.member.dto.EmployeeRemovalImpactPlan.TaskResponsibility> taskSetters,
        List<CertificationAudienceChange> certificationAudienceChanges,
        int reservationsToRelease
) {
    public record Position(Long id, String name) { }
    public record CertificationAudienceChange(Long certificationId, String title, boolean entersAudience) { }
    public record OwnershipState(Long resourceId, long version, Long ownerUserId) { }
    public record PositionSnapshot(String name, ru.staffly.restaurant.model.RestaurantRole level,
            java.util.Set<ru.staffly.dictionary.model.PositionSpecialization> specializations,
            ru.staffly.master_schedule.model.PayType payType, java.math.BigDecimal payRate, Integer normHours) {
        public PositionSnapshot {
            if (payRate != null) payRate = payRate.stripTrailingZeros();
            if (specializations != null) specializations = java.util.Set.copyOf(specializations);
        }
        public static PositionSnapshot of(ru.staffly.dictionary.model.Position position) {
            return new PositionSnapshot(position.getName(), position.getLevel(), java.util.Set.copyOf(position.getSpecializations()),
                    position.getPayType(), position.getPayRate() == null ? null : position.getPayRate().stripTrailingZeros(), position.getNormHours());
        }
    }

    public record Employee(Long memberId, String name, Position oldPosition, Position newPosition,
                           Instant memberCreatedAt) { }

    public record OldPositionImpact(
            Long scheduleId, String scheduleTitle, ScheduleStatus scheduleStatus, Long scheduleVersion,
            long preferenceCollectionCycle, Instant currentPreferenceDeadline,
            Long participationId, boolean participationWillBeRemoved,
            Long preferenceSubmissionId, Integer preferenceSubmissionRevision,
            boolean preferenceDataWillBeDeleted, boolean progressDenominatorWillChange,
            boolean autoBuildWillBecomeStale, boolean activeRowWillBeRemoved,
            boolean publishedRowBecomesHistorical, PublishedShiftImpact publishedShiftImpact
    ) { }

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
        ADD_TO_DRAFT,
        DO_NOT_ADD_TO_DRAFT,
        INFORMATION_ONLY
    }

    public enum EligibilityProblem {
        MISSING_PREFERENCE_MODE,
        MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION
    }
}
