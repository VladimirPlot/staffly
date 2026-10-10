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
        @NotNull @Valid List<ScheduleDecision> schedules,
        @NotNull @Valid PositionChangeImpactPlan.PositionSnapshot expectedCurrentPosition,
        @NotNull @Valid PositionChangeImpactPlan.PositionSnapshot expectedTargetPosition,
        @NotNull List<PositionChangeImpactPlan.OwnershipState> expectedScheduleOwnershipState,
        @NotNull List<PositionChangeImpactPlan.OwnershipState> expectedCertificationOwnershipState,
        @Valid List<ApplyEmployeeRemovalRequest.OwnershipTransfer> scheduleOwnershipTransfers,
        @Valid List<ApplyEmployeeRemovalRequest.OwnershipTransfer> certificationOwnershipTransfers,
        @Valid List<ApplyEmployeeRemovalRequest.TaskTransfer> taskSetterTransfers,
        @Valid List<ru.staffly.task.dto.TaskAudienceDecision> taskDecisions) {
    public ApplyPositionChangeRequest(
        @NotNull Long targetPositionId,
        @NotNull Long expectedCurrentPositionId,
        @NotNull Instant expectedMemberCreatedAt,
        @NotNull @Valid List<ScheduleDecision> schedules,
        @NotNull @Valid PositionChangeImpactPlan.PositionSnapshot expectedCurrentPosition,
        @NotNull @Valid PositionChangeImpactPlan.PositionSnapshot expectedTargetPosition,
        @NotNull List<PositionChangeImpactPlan.OwnershipState> expectedScheduleOwnershipState,
        @NotNull List<PositionChangeImpactPlan.OwnershipState> expectedCertificationOwnershipState,
        @Valid List<ApplyEmployeeRemovalRequest.OwnershipTransfer> scheduleOwnershipTransfers,
        @Valid List<ApplyEmployeeRemovalRequest.OwnershipTransfer> certificationOwnershipTransfers,
        @Valid List<ApplyEmployeeRemovalRequest.TaskTransfer> taskSetterTransfers
) {
        this(targetPositionId, expectedCurrentPositionId, expectedMemberCreatedAt, schedules, expectedCurrentPosition, expectedTargetPosition, expectedScheduleOwnershipState, expectedCertificationOwnershipState, scheduleOwnershipTransfers, certificationOwnershipTransfers, taskSetterTransfers, List.of());
    }

    public ApplyPositionChangeRequest {
        taskDecisions = taskDecisions == null ? List.of() : List.copyOf(taskDecisions);
        scheduleOwnershipTransfers = scheduleOwnershipTransfers == null ? List.of() : List.copyOf(scheduleOwnershipTransfers);
        certificationOwnershipTransfers = certificationOwnershipTransfers == null ? List.of() : List.copyOf(certificationOwnershipTransfers);
        taskSetterTransfers = taskSetterTransfers == null ? List.of() : List.copyOf(taskSetterTransfers);
    }
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
