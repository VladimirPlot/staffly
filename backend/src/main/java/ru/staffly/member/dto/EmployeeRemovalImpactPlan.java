package ru.staffly.member.dto;

import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

/** Authoritative, read-only preview for the later atomic employee-removal command. */
public record EmployeeRemovalImpactPlan(
        Instant calculatedAt,
        Employee employee,
        List<ScheduleImpact> scheduleImpacts
) {
    public record Position(Long id, String name) { }

    public record Employee(Long memberId, String name, Position currentPosition, Instant memberCreatedAt) { }

    public record ScheduleImpact(
            Long scheduleId, String scheduleTitle, ScheduleStatus scheduleStatus, Long scheduleVersion,
            long preferenceCollectionCycle, Instant currentPreferenceDeadline,
            Long participationId, Long preferenceSubmissionId, Integer preferenceSubmissionRevision,
            boolean participationWillBeRemoved, boolean preferenceDataWillBeDeleted,
            boolean progressDenominatorWillChange, boolean appliedPreferenceDraftWillBeInvalidated,
            boolean activeDraftRowWillBeRemoved, boolean publishedRowBecomesHistorical,
            PublishedShiftImpact publishedShiftImpact
    ) { }
}
