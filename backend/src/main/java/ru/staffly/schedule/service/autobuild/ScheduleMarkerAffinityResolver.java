package ru.staffly.schedule.service.autobuild;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/** Resolves schedule-specific marker affinity from already loaded identifier projections. */
public final class ScheduleMarkerAffinityResolver {
    private ScheduleMarkerAffinityResolver() {
    }

    public static List<Long> resolveEffectiveMemberIds(
            Set<Long> configPositionIds,
            Set<Long> markerMemberIds,
            Map<Long, CandidatePositionIds> candidatesByMemberId
    ) {
        return markerMemberIds.stream()
                .filter(Objects::nonNull)
                .filter(memberId -> {
                    CandidatePositionIds candidate = candidatesByMemberId.get(memberId);
                    return candidate != null
                            && configPositionIds.contains(candidate.participationPositionId())
                            && configPositionIds.contains(candidate.currentMemberPositionId());
                })
                .sorted()
                .toList();
    }

    /** The two position identifiers relevant to affinity, not to general planner eligibility. */
    public record CandidatePositionIds(Long participationPositionId, Long currentMemberPositionId) {
    }
}
