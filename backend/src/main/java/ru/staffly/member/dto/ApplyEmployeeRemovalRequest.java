package ru.staffly.member.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

/** Optimistic snapshot copied verbatim from the authoritative removal impact plan. */
public record ApplyEmployeeRemovalRequest(
        @NotNull Instant expectedMemberCreatedAt,
        Long expectedCurrentPositionId,
        @NotNull @Valid List<ScheduleToken> schedules
) {
    public record ScheduleToken(
            @NotNull Long scheduleId,
            @NotNull Long expectedVersion,
            @NotNull ScheduleStatus expectedStatus,
            @NotNull Long expectedCollectionCycle,
            Instant expectedPreferenceDeadline,
            Long expectedParticipationId,
            Long expectedPreferenceSubmissionId,
            Integer expectedPreferenceSubmissionRevision
    ) { }
}
