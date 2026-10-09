package ru.staffly.member.dto;

import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;
import ru.staffly.member.lifecycle.TerminationMode;

/** Authoritative, read-only preview for the later atomic employee-removal command. */
public record EmployeeRemovalImpactPlan(
        Instant calculatedAt,
        TerminationMode mode,
        Employee employee,
        List<ScheduleImpact> scheduleImpacts,
        OwnershipImpact scheduleOwnership,
        OwnershipImpact certificationOwnership,
        TaskImpact taskImpact,
        AutomaticImpact checklistImpact,
        AutomaticImpact reminderImpact
) {
    public record Position(Long id, String name) { }

    public record Employee(Long memberId, String name, Position currentPosition, Instant memberCreatedAt) { }
    public record Candidate(Long memberId, Long userId, String name, String position) { }
    public record OwnershipResource(Long resourceId, String title, long version,
                                    Long expectedOwnerUserId, List<Candidate> candidates) { }
    public record OwnershipImpact(List<OwnershipResource> requiredTransfers) { }
    public record TaskResponsibility(Long taskId, long version, String title, String dueDate,
                                     boolean replacementRequired, List<Candidate> candidates) { }
    public record TaskImpact(List<TaskResponsibility> assigneeResponsibilities,
                             List<TaskResponsibility> setterResponsibilities) { }
    public record AutomaticImpact(int affectedCount) { }

    /**
     * Participation and submission removal flags describe existing records in any status.
     * Progress denominator refers only to the ongoing COLLECTING_PREFERENCES progress.
     * Active draft row removal covers DRAFT and DRAFT_FROM_PREFERENCES, not collection rows.
     * Auto-build staleness describes Apply marking an affected DRAFT_FROM_PREFERENCES stale,
     * including a draft that was already stale. Published effects concern only active rows.
     */
    public record ScheduleImpact(
            Long scheduleId, String scheduleTitle, ScheduleStatus scheduleStatus, Long scheduleVersion,
            long preferenceCollectionCycle, Instant currentPreferenceDeadline,
            Long participationId, Long preferenceSubmissionId, Integer preferenceSubmissionRevision,
            boolean participationWillBeRemoved, boolean preferenceDataWillBeDeleted,
            boolean progressDenominatorWillChange, boolean autoBuildWillBecomeStale,
            boolean activeDraftRowWillBeRemoved, boolean publishedRowBecomesHistorical,
            PublishedShiftImpact publishedShiftImpact
    ) { }
}
