package ru.staffly.member.dto;

import java.time.Instant;
import java.util.List;

public record ApplyPositionChangeResult(
        MemberDto member,
        List<Long> affectedScheduleIds,
        List<ReopenedCollection> reopenedCollections,
        int cancelledFutureShiftCount
) {
    public record ReopenedCollection(Long scheduleId, Instant deadline) { }
}
