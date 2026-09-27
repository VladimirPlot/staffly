package ru.staffly.member.dto;

import java.time.Instant;
import java.util.Set;

/** Immutable schedule truth captured under the position-change transaction's locks. */
public record AppliedPositionChangeScheduleEffect(
        Long scheduleId,
        String scheduleTitle,
        Long ownerUserId,
        Long memberId,
        Set<PositionChangeScheduleEffectType> consequences,
        Instant preferenceDeadline,
        int cancelledFutureShiftCount
) {
    public AppliedPositionChangeScheduleEffect {
        consequences = Set.copyOf(consequences);
    }
}
