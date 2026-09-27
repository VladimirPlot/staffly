package ru.staffly.invite.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import jakarta.validation.Valid;
import ru.staffly.invite.model.InvitationScheduleIntentAction;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;
import java.util.List;

public record InviteRequest(
        @NotBlank @Size(max = 32) String phone,
        @NotNull Long positionId,
        @NotNull @Valid List<ScheduleDecision> scheduleIntents
) {
    public record ScheduleDecision(
            @NotNull Long scheduleId,
            @NotNull InvitationScheduleIntentAction selectedAction,
            Instant requestedDeadline,
            @NotNull Long expectedScheduleVersion,
            @NotNull ScheduleStatus expectedScheduleStatus,
            long expectedCollectionCycle,
            Instant expectedPreferenceDeadline,
            PreferenceCollectionMode expectedPreferenceMode
    ) { }
}
