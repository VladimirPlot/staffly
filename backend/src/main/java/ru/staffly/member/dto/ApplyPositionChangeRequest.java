package ru.staffly.member.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import ru.staffly.member.dto.PositionChangeImpactPlan.Action;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

/** Narrow optimistic token set returned by the impact preview and selected manager actions. */
public record ApplyPositionChangeRequest(
        @NotNull Long targetPositionId,
        @NotNull Long expectedCurrentPositionId,
        @NotNull Instant expectedMemberCreatedAt,
        @NotNull @Valid List<ScheduleDecision> schedules
) {
    public record ScheduleDecision(
            @NotNull Long scheduleId,
            @NotNull Long expectedVersion,
            @NotNull ScheduleStatus expectedStatus,
            @NotNull Long expectedCollectionCycle,
            Instant expectedPreferenceDeadline,
            Long expectedParticipationId,
            Long expectedPreferenceSubmissionId,
            Integer expectedPreferenceSubmissionRevision,
            Action action,
            Instant newDeadline
    ) { }
}
