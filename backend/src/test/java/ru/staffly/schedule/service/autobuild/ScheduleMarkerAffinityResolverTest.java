package ru.staffly.schedule.service.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.schedule.service.autobuild.ScheduleMarkerAffinityResolver.CandidatePositionIds;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScheduleMarkerAffinityResolverTest {
    private static final long WAITER = 10L;
    private static final long SENIOR_WAITER = 11L;
    private static final long COOK = 20L;

    @Test
    void includesOnlyMarkedCandidatesWhoseParticipationAndCurrentPositionsAreInBlock() {
        Map<Long, CandidatePositionIds> candidates = Map.of(
                100L, candidate(WAITER, WAITER),
                101L, candidate(WAITER, WAITER),
                102L, candidate(WAITER, COOK),
                103L, candidate(COOK, WAITER),
                104L, candidate(null, WAITER),
                105L, candidate(WAITER, null));

        assertThat(resolve(Set.of(WAITER), Set.of(100L, 102L, 103L, 104L, 105L, 999L), candidates))
                .containsExactly(100L);
    }

    @Test
    void rejectsMissingParticipationPositionForDifferentPositionSetImplementations() {
        assertMissingPositionIsRejected(candidate(null, WAITER));
    }

    @Test
    void rejectsMissingCurrentPositionForDifferentPositionSetImplementations() {
        assertMissingPositionIsRejected(candidate(WAITER, null));
    }

    @Test
    void rejectsBothMissingPositionsForDifferentPositionSetImplementations() {
        assertMissingPositionIsRejected(candidate(null, null));
    }

    private void assertMissingPositionIsRejected(CandidatePositionIds candidate) {
        for (Set<Long> positions : positionSetImplementations()) {
            assertThat(resolve(positions, Set.of(100L), Map.of(100L, candidate)))
                    .as("missing position IDs with %s", positions.getClass().getName())
                    .isEmpty();
        }
    }

    @Test
    void permitsDifferentParticipationAndCurrentPositionsWithinTheSameBlock() {
        assertThat(resolve(Set.of(WAITER, SENIOR_WAITER), Set.of(100L),
                Map.of(100L, candidate(WAITER, SENIOR_WAITER))))
                .containsExactly(100L);
    }

    @Test
    void returnsEmptyForEmptyCandidatesOrMembership() {
        assertThat(resolve(Set.of(WAITER), Set.of(), Map.of(100L, candidate(WAITER, WAITER)))).isEmpty();
        assertThat(resolve(Set.of(WAITER), Set.of(100L), Map.of())).isEmpty();
    }

    @Test
    void resultIsSortedAndIndependentOfInputIterationOrder() {
        Map<Long, CandidatePositionIds> forwardCandidates = new LinkedHashMap<>();
        forwardCandidates.put(102L, candidate(WAITER, WAITER));
        forwardCandidates.put(100L, candidate(WAITER, WAITER));
        forwardCandidates.put(101L, candidate(WAITER, WAITER));
        Map<Long, CandidatePositionIds> reverseCandidates = new LinkedHashMap<>();
        reverseCandidates.put(101L, candidate(WAITER, WAITER));
        reverseCandidates.put(100L, candidate(WAITER, WAITER));
        reverseCandidates.put(102L, candidate(WAITER, WAITER));

        List<Long> forward = resolve(new LinkedHashSet<>(List.of(WAITER, SENIOR_WAITER)),
                new LinkedHashSet<>(List.of(102L, 100L, 101L)), forwardCandidates);
        List<Long> reverse = resolve(new LinkedHashSet<>(List.of(SENIOR_WAITER, WAITER)),
                new LinkedHashSet<>(List.of(101L, 100L, 102L)), reverseCandidates);

        assertThat(forward).containsExactly(100L, 101L, 102L).isEqualTo(reverse);
    }

    @Test
    void callsUseOnlyTheirOwnMarkerAndBlockScope() {
        Map<Long, CandidatePositionIds> candidates = Map.of(
                100L, candidate(WAITER, WAITER),
                200L, candidate(COOK, COOK));

        assertThat(resolve(Set.of(WAITER), Set.of(100L), candidates)).containsExactly(100L);
        assertThat(resolve(Set.of(COOK), Set.of(200L), candidates)).containsExactly(200L);
        assertThat(resolve(Set.of(WAITER), Set.of(200L), candidates)).isEmpty();
    }

    @Test
    void doesNotMutateInputsAndReturnsAnUnmodifiableResult() {
        Set<Long> positions = new LinkedHashSet<>(List.of(WAITER));
        Set<Long> members = new LinkedHashSet<>(List.of(100L));
        Map<Long, CandidatePositionIds> candidates = new LinkedHashMap<>();
        candidates.put(100L, candidate(WAITER, WAITER));

        List<Long> result = resolve(positions, members, candidates);

        assertThat(positions).containsExactly(WAITER);
        assertThat(members).containsExactly(100L);
        assertThat(candidates).containsOnlyKeys(100L);
        assertThatThrownBy(() -> result.add(101L)).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void matchesThePreviousFingerprintMembershipExpression() {
        Set<Long> positions = Set.of(WAITER, SENIOR_WAITER);
        Set<Long> members = new LinkedHashSet<>(List.of(104L, 102L, 100L, 999L));
        Map<Long, CandidatePositionIds> candidates = Map.of(
                100L, candidate(WAITER, SENIOR_WAITER),
                102L, candidate(WAITER, COOK),
                104L, candidate(SENIOR_WAITER, WAITER));

        List<Long> previousExpression = members.stream()
                .filter(memberId -> {
                    CandidatePositionIds candidate = candidates.get(memberId);
                    return candidate != null
                            && positions.contains(candidate.participationPositionId())
                            && positions.contains(candidate.currentMemberPositionId());
                })
                .sorted().toList();

        assertThat(resolve(positions, members, candidates)).isEqualTo(previousExpression);
    }

    private List<Long> resolve(Set<Long> positions, Set<Long> members,
                               Map<Long, CandidatePositionIds> candidates) {
        return ScheduleMarkerAffinityResolver.resolveEffectiveMemberIds(positions, members, candidates);
    }

    private CandidatePositionIds candidate(Long participationPositionId, Long currentMemberPositionId) {
        return new CandidatePositionIds(participationPositionId, currentMemberPositionId);
    }

    private List<Set<Long>> positionSetImplementations() {
        return List.of(
                Set.of(WAITER),
                Set.copyOf(List.of(WAITER)),
                new HashSet<>(List.of(WAITER)),
                new LinkedHashSet<>(List.of(WAITER)));
    }
}
