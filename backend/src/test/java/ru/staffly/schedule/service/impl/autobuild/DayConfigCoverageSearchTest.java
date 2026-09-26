package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DayConfigCoverageSearchTest {
    @Test
    void equivalentEmployeesRemainAvailableForTwoPieceSplit() {
        var requirement = new DayConfigCoverageSearch.Requirement(1, 600, 1440, 1);
        var first = employee(1, choice(1, 600, 1020, 0), choice(1, 1020, 1440, 0));
        var second = employee(2, choice(2, 600, 1020, 0), choice(2, 1020, 1440, 0));
        var winner = new DayConfigCoverageSearch(List.of(requirement), List.of(first, second)).solve();
        assertEquals(0, winner.uncoveredDemandMinutes());
        assertEquals(2, winner.distinctEmployeeCount());
        assertEquals(2, winner.choices().stream().map(DayConfigCoverageSearch.Choice::memberId).distinct().count());
    }

    @Test
    void equivalentEmployeesRemainAvailableForThreePieceSplit() {
        var requirement = new DayConfigCoverageSearch.Requirement(1, 600, 1320, 1);
        List<DayConfigCoverageSearch.Employee> employees = new ArrayList<>();
        for (int id = 1; id <= 3; id++) employees.add(employee(id,
                choice(id, 600, 840, 0), choice(id, 840, 1080, 0), choice(id, 1080, 1320, 0)));
        var winner = new DayConfigCoverageSearch(List.of(requirement), employees).solve();
        assertEquals(0, winner.uncoveredDemandMinutes());
        assertEquals(3, winner.distinctEmployeeCount());
    }

    @Test
    void fullSingleWinsEqualConflictSplitByEmployeeCount() {
        var requirement = new DayConfigCoverageSearch.Requirement(1, 600, 1440, 1);
        var winner = new DayConfigCoverageSearch(List.of(requirement), List.of(
                employee(1, choice(1, 600, 1440, 0)),
                employee(2, choice(2, 600, 1020, 0)), employee(3, choice(3, 1020, 1440, 0)))).solve();
        assertEquals(List.of(1L), winner.choices().stream().map(DayConfigCoverageSearch.Choice::memberId).toList());
    }

    @Test
    void separateRequirementsCannotBeMergedIntoUnrequestedFullOption() {
        List<DayConfigCoverageSearch.Requirement> requirements = List.of(
                new DayConfigCoverageSearch.Requirement(1, 600, 1020, 1),
                new DayConfigCoverageSearch.Requirement(2, 1020, 1440, 1));
        var employee = employee(1, choice(1, 600, 1020, 0), choice(1, 1020, 1440, 1),
                choice(1, 600, 1440, 0));
        var winner = new DayConfigCoverageSearch(requirements, List.of(employee)).solve();
        assertEquals(420, winner.uncoveredDemandMinutes());
        assertEquals(1, winner.distinctEmployeeCount());
        assertTrue(winner.choices().get(0).end() - winner.choices().get(0).start() == 420);
    }

    @Test
    void exploresNonFirstLaneEquivalentAndFindsFivePersonConflictFreeCompletion() {
        var requirement = new DayConfigCoverageSearch.Requirement(1, 600, 1080, 2);
        List<DayConfigCoverageSearch.Employee> employees = List.of(
                employee(1, choice(1, 600, 840, 0)), employee(2, choice(2, 960, 1080, 0)),
                employee(3, choice(3, 840, 960, 0)), employee(4, choice(4, 600, 960, 0)),
                employee(5, choice(5, 960, 1080, 0)));

        var winner = new DayConfigCoverageSearch(List.of(requirement), employees).solve();

        assertEquals(0, winner.uncoveredDemandMinutes());
        assertEquals(0, winner.hardConflictMinutes());
        assertEquals(5, winner.distinctEmployeeCount());
        assertEquals(0, winner.unfilledCount());
        // Independent tiny oracle: enumerate physical subsets and calculate segment coverage
        // directly, without the production DFS, pruning, or lane normalization.
        assertEquals(exhaustiveBestUncovered(employees, 600, 1080, 2), winner.uncoveredDemandMinutes());
        List<DayConfigCoverageSearch.Employee> reversed = new ArrayList<>(employees);
        Collections.reverse(reversed);
        assertEquals(winner.choices().stream().map(DayConfigCoverageSearch.Choice::memberId).sorted().toList(),
                new DayConfigCoverageSearch(List.of(requirement), reversed).solve().choices().stream()
                        .map(DayConfigCoverageSearch.Choice::memberId).sorted().toList());
    }

    @Test
    void unfilledCountMaximizesCompleteUnitsInsteadOfDependingOnLaneHistory() {
        var solution = new DayConfigCoverageSearch(
                List.of(new DayConfigCoverageSearch.Requirement(1, 600, 1440, 2)),
                List.of(employee(1, choice(1, 600, 1020, 0)), employee(2, choice(2, 1020, 1440, 0)))).solve();
        assertEquals(1, solution.unfilledCount());
        assertEquals(840, solution.uncoveredDemandMinutes());
    }

    @Test
    void workloadOfEveryParticipantPrecedesNamesAndIdsAndComparatorIsTransitive() {
        var a = solution(List.of(choice(1, 600, 720, 0, 10), choice(2, 720, 840, 0, 9)));
        var b = solution(List.of(choice(90, 600, 720, 0, 10), choice(91, 720, 840, 0, 1)));
        var c = solution(List.of(choice(92, 600, 720, 0, 11), choice(93, 720, 840, 0, 1)));
        assertTrue(DayConfigCoverageSearch.compare(b, a) < 0);
        assertTrue(DayConfigCoverageSearch.compare(a, c) < 0);
        assertTrue(DayConfigCoverageSearch.compare(b, c) < 0);
    }

    @Test
    void repeatedWorkloadValuesRetainMultiplicity() {
        var repeated = solution(List.of(choice(1, 600, 720, 0, 10), choice(2, 720, 840, 0, 10)));
        var lowerSecond = solution(List.of(choice(90, 600, 720, 0, 10), choice(91, 720, 840, 0, 1)));
        assertTrue(DayConfigCoverageSearch.compare(lowerSecond, repeated) < 0);

        var winner = new DayConfigCoverageSearch(
                List.of(new DayConfigCoverageSearch.Requirement(1, 600, 720, 2)),
                List.of(employee(1, choice(1, 600, 720, 0, 10)),
                        employee(2, choice(2, 600, 720, 0, 10)),
                        employee(3, choice(3, 600, 720, 0, 1)))).solve();
        assertEquals(List.of(1L, 3L), winner.choices().stream()
                .map(DayConfigCoverageSearch.Choice::memberId).sorted().toList());
    }

    @Test
    void requirementPermutationProducesSameCanonicalWinner() {
        var early = new DayConfigCoverageSearch.Requirement(10, 600, 720, 1, 2);
        var late = new DayConfigCoverageSearch.Requirement(2, 840, 960, 1, 1);
        var forward = new DayConfigCoverageSearch(List.of(early, late), List.of(employee(1,
                choice(1, 600, 720, 0), choice(1, 840, 960, 1)))).solve();
        var reversed = new DayConfigCoverageSearch(List.of(late, early), List.of(employee(1,
                choice(1, 600, 720, 1), choice(1, 840, 960, 0)))).solve();
        assertEquals(semanticChoices(forward), semanticChoices(reversed));
        assertEquals(forward.uncoveredDemandMinutes(), reversed.uncoveredDemandMinutes());
    }

    @Test
    void productionSearchMatchesIndependentMultiChoiceMultiRequirementOracle() {
        List<DayConfigCoverageSearch.Requirement> requirements = List.of(
                new DayConfigCoverageSearch.Requirement(2, 600, 1020, 1),
                new DayConfigCoverageSearch.Requirement(10, 1020, 1440, 1));
        List<DayConfigCoverageSearch.Employee> employees = List.of(
                employee(1, choice(1, 600, 1020, 0, 3), conflictChoice(1, 1020, 1440, 1, 0, 40)),
                employee(2, conflictChoice(2, 600, 1020, 0, 0, 20), choice(2, 1020, 1440, 1, 1)),
                employee(3, choice(3, 600, 1020, 0, 1), choice(3, 1020, 1440, 1, 1)));
        var actual = new DayConfigCoverageSearch(requirements, employees).solve();
        OracleQuality expected = exhaustiveQuality(requirements, employees, 0, new ArrayList<>());
        assertEquals(expected, new OracleQuality(actual.uncoveredDemandMinutes(), actual.hardConflictMinutes(),
                actual.softConflictMinutes(), actual.distinctEmployeeCount()));
    }

    @Test
    void symmetryReductionAvoidsThirtyChooseTenEnumeration() {
        List<DayConfigCoverageSearch.Employee> employees = new ArrayList<>();
        for (int i = 1; i <= 30; i++) employees.add(employee(i, choice(i, 600, 1080, 0)));
        var winner = new DayConfigCoverageSearch(
                List.of(new DayConfigCoverageSearch.Requirement(1, 600, 1080, 10)), employees).solve();
        assertEquals(10, winner.distinctEmployeeCount());
        assertEquals(0, winner.uncoveredDemandMinutes());
        assertTrue(winner.statistics().visitedStates() < 25_000, winner.statistics().toString());
    }

    @Test
    void symmetryBoundKeepsTwentyEmployeesNeededForTenSplits() {
        List<DayConfigCoverageSearch.Employee> employees = new ArrayList<>();
        for (int i = 1; i <= 30; i++) employees.add(employee(i,
                choice(i, 600, 1020, 0), choice(i, 1020, 1440, 0)));
        var winner = new DayConfigCoverageSearch(
                List.of(new DayConfigCoverageSearch.Requirement(1, 600, 1440, 10)), employees).solve();
        assertEquals(0, winner.uncoveredDemandMinutes());
        assertEquals(20, winner.distinctEmployeeCount());
    }

    private static List<String> semanticChoices(DayConfigCoverageSearch.Solution solution) {
        return solution.choices().stream().map(c -> c.memberId() + ":" + c.start() + "-" + c.end()).sorted().toList();
    }

    private static DayConfigCoverageSearch.Solution solution(List<DayConfigCoverageSearch.Choice> choices) {
        return new DayConfigCoverageSearch.Solution(choices, 0, 0, 0, choices.size(), 0, null);
    }

    private static long exhaustiveBestUncovered(List<DayConfigCoverageSearch.Employee> employees,
                                                 int start, int end, int required) {
        long best = Long.MAX_VALUE;
        for (int mask = 0; mask < (1 << employees.size()); mask++) {
            long uncovered = 0;
            for (int minute = start; minute < end; minute++) {
                int assigned = 0;
                for (int employee = 0; employee < employees.size(); employee++) {
                    if ((mask & (1 << employee)) == 0) continue;
                    var choice = employees.get(employee).choices().get(0);
                    if (choice.start() <= minute && minute < choice.end()) assigned++;
                }
                if (assigned > required) { uncovered = Long.MAX_VALUE; break; }
                uncovered += required - assigned;
            }
            best = Math.min(best, uncovered);
        }
        return best;
    }

    private record OracleQuality(long uncovered, long hard, long soft, int employees)
            implements Comparable<OracleQuality> {
        @Override public int compareTo(OracleQuality other) {
            int value = Long.compare(uncovered, other.uncovered);
            if (value == 0) value = Long.compare(hard, other.hard);
            if (value == 0) value = Long.compare(soft, other.soft);
            return value != 0 ? value : Integer.compare(employees, other.employees);
        }
    }

    private static OracleQuality exhaustiveQuality(List<DayConfigCoverageSearch.Requirement> requirements,
                                                    List<DayConfigCoverageSearch.Employee> employees,
                                                    int employeeIndex,
                                                    List<DayConfigCoverageSearch.Choice> selected) {
        if (employeeIndex == employees.size()) return oracleQuality(requirements, selected);
        OracleQuality best = exhaustiveQuality(requirements, employees, employeeIndex + 1, selected);
        for (var choice : employees.get(employeeIndex).choices()) {
            selected.add(choice);
            OracleQuality candidate = exhaustiveQuality(requirements, employees, employeeIndex + 1, selected);
            if (candidate.compareTo(best) < 0) best = candidate;
            selected.remove(selected.size() - 1);
        }
        return best;
    }

    private static OracleQuality oracleQuality(List<DayConfigCoverageSearch.Requirement> requirements,
                                               List<DayConfigCoverageSearch.Choice> selected) {
        long uncovered = 0;
        for (int minute = requirements.stream().mapToInt(DayConfigCoverageSearch.Requirement::start).min().orElse(0);
             minute < requirements.stream().mapToInt(DayConfigCoverageSearch.Requirement::end).max().orElse(0); minute++) {
            int aggregateRequired = 0, aggregateAssigned = 0;
            for (int r = 0; r < requirements.size(); r++) {
                var requirement = requirements.get(r);
                if (requirement.start() > minute || minute >= requirement.end()) continue;
                aggregateRequired += requirement.count();
                int assigned = 0;
                for (var choice : selected) {
                    if (choice.requirementIndex() != r) continue;
                    if (choice.start() < requirement.start() || choice.end() > requirement.end())
                        return new OracleQuality(Long.MAX_VALUE, 0, 0, 0);
                    if (choice.start() <= minute && minute < choice.end()) assigned++;
                }
                if (assigned > requirement.count()) return new OracleQuality(Long.MAX_VALUE, 0, 0, 0);
                aggregateAssigned += assigned;
                uncovered += requirement.count() - assigned;
            }
            if (aggregateAssigned > aggregateRequired) return new OracleQuality(Long.MAX_VALUE, 0, 0, 0);
        }
        return new OracleQuality(uncovered,
                selected.stream().mapToLong(DayConfigCoverageSearch.Choice::hardConflictMinutes).sum(),
                selected.stream().mapToLong(DayConfigCoverageSearch.Choice::softConflictMinutes).sum(), selected.size());
    }
    private static DayConfigCoverageSearch.Employee employee(long id, DayConfigCoverageSearch.Choice... choices) {
        return new DayConfigCoverageSearch.Employee(id, List.of(choices));
    }
    private static DayConfigCoverageSearch.Choice choice(long id, int start, int end, int requirement) {
        return choice(id, start, end, requirement, 0);
    }
    private static DayConfigCoverageSearch.Choice choice(long id, int start, int end, int requirement, int fairness) {
        return conflictChoice(id, start, end, requirement, fairness, 0);
    }
    private static DayConfigCoverageSearch.Choice conflictChoice(long id, int start, int end, int requirement,
                                                                  int fairness, long hard) {
        return new DayConfigCoverageSearch.Choice(id,
                new DayConfigCoverageSearch.EmployeeKey("Employee " + id, id),
                new DayConfigCoverageSearch.WorkloadKey(false, fairness, 0), 1, 0,
                start, end, requirement, hard, 0, null);
    }
}
