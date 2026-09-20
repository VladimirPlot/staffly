package ru.staffly.member.dto;

import java.util.List;

public record ApplyEmployeeRemovalResult(
        Long removedMemberId,
        List<Long> affectedScheduleIds,
        int cancelledFutureShiftCount,
        int historicalPublishedRowCount,
        int removedPreferenceSubmissionCount,
        int removedParticipationCount,
        int invalidatedAppliedPreferenceDraftCount
) { }
