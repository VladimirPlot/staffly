package ru.staffly.invite.dto;

import ru.staffly.invite.model.InvitationScheduleIntentAction;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

public record InvitationImpactPlan(
        Instant calculatedAt,
        Candidate candidate,
        List<ScheduleOpportunity> scheduleOpportunities
) {
    public record Candidate(String phone, Long targetPositionId, String targetPositionName,
                            RestaurantRole role) { }

    public record ScheduleOpportunity(
            Long scheduleId,
            String scheduleTitle,
            ScheduleStatus scheduleStatus,
            Long scheduleVersion,
            long preferenceCollectionCycle,
            Instant currentPreferenceDeadline,
            List<InvitationScheduleIntentAction> allowedActions,
            PreferenceCollectionMode preferenceMode,
            boolean targetPositionEligible,
            boolean frozenShiftOptionsRequired,
            boolean frozenShiftOptionsAvailable,
            Long preferenceBuildTemplateId,
            List<Long> applicableFrozenShiftOptionSnapshotIds,
            List<EligibilityProblem> eligibilityProblems,
            boolean newDeadlineRequired,
            boolean lessThanSixHoursRemain
    ) { }

    public enum EligibilityProblem {
        MISSING_PREFERENCE_MODE,
        MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION
    }
}
