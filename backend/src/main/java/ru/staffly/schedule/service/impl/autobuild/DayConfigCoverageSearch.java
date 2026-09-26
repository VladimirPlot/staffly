package ru.staffly.schedule.service.impl.autobuild;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Exact, repository-free search for one business day and one position block. */
final class DayConfigCoverageSearch {
    record Requirement(long key, int start, int end, int count, int sortOrder) {
        Requirement(long key, int start, int end, int count) { this(key, start, end, count, 0); }
        Requirement {
            if (start >= end || count < 0) throw new IllegalArgumentException("Invalid requirement");
        }
    }
    record WorkloadKey(boolean minRestViolation, int fairnessScore, int priorShiftCount)
            implements Comparable<WorkloadKey> {
        @Override public int compareTo(WorkloadKey other) {
            int value = Boolean.compare(minRestViolation, other.minRestViolation);
            if (value == 0) value = Integer.compare(fairnessScore, other.fairnessScore);
            if (value == 0) value = Integer.compare(priorShiftCount, other.priorShiftCount);
            return value;
        }
    }
    record EmployeeKey(String displayName, long memberId) implements Comparable<EmployeeKey> {
        @Override public int compareTo(EmployeeKey other) {
            int value = String.CASE_INSENSITIVE_ORDER.compare(displayName, other.displayName);
            return value != 0 ? value : Long.compare(memberId, other.memberId);
        }
    }
    record Choice(long memberId, EmployeeKey employeeKey, WorkloadKey workloadKey, long optionId,
                  int optionSortOrder, int start, int end, int requirementIndex,
                  long hardConflictMinutes, long softConflictMinutes, Object payload) { }
    record Employee(long memberId, List<Choice> choices) { }
    record Statistics(long visitedStates, long branches, long coveragePrunes) { }
    record Solution(List<Choice> choices, long uncoveredDemandMinutes, long hardConflictMinutes,
                    long softConflictMinutes, int distinctEmployeeCount, int unfilledCount,
                    Statistics statistics) { }

    private final List<Requirement> requirements;
    private final List<Employee> employees;
    private final int[] boundaries;
    private final int[] aggregateCapacity;
    private final int[][] requirementCapacity;
    private final int[] symmetryGroupEnd;
    private Solution best;
    private long visited;
    private long branches;
    private long coveragePrunes;

    DayConfigCoverageSearch(List<Requirement> requirements, List<Employee> employees) {
        this.boundaries = boundaries(requirements, employees);
        List<IndexedRequirement> normalized = java.util.stream.IntStream.range(0, requirements.size())
                .mapToObj(i -> new IndexedRequirement(i, requirements.get(i)))
                .sorted(Comparator.comparingInt((IndexedRequirement r) -> r.requirement.start)
                        .thenComparingInt(r -> r.requirement.end)
                        .thenComparingInt(r -> r.requirement.count)
                        .thenComparingInt(r -> r.requirement.sortOrder)
                        .thenComparingLong(r -> r.requirement.key))
                .toList();
        int[] newIndex = new int[requirements.size()];
        for (int i = 0; i < normalized.size(); i++) newIndex[normalized.get(i).originalIndex] = i;
        this.requirements = normalized.stream().map(IndexedRequirement::requirement).toList();
        this.aggregateCapacity = new int[Math.max(0, boundaries.length - 1)];
        this.requirementCapacity = new int[requirements.size()][aggregateCapacity.length];
        for (int r = 0; r < this.requirements.size(); r++) {
            Requirement requirement = this.requirements.get(r);
            for (int s = 0; s < aggregateCapacity.length; s++) {
                if (inside(s, requirement.start, requirement.end)) {
                    aggregateCapacity[s] += requirement.count;
                    requirementCapacity[r][s] = requirement.count;
                }
            }
        }
        List<Employee> remapped = employees.stream().map(employee -> new Employee(employee.memberId,
                employee.choices.stream().map(choice -> remap(choice, newIndex[choice.requirementIndex])).toList())).toList();
        int maximumUsefulEmployees = Arrays.stream(aggregateCapacity).sum();
        this.employees = reduceProvenEmployeeSymmetry(remapped, maximumUsefulEmployees);
        this.symmetryGroupEnd = new int[this.employees.size()];
        for (int start = 0; start < this.employees.size();) {
            List<ChoiceSignature> signature = signature(this.employees.get(start));
            int end = start + 1;
            while (end < this.employees.size() && signature.equals(signature(this.employees.get(end)))) end++;
            for (int i = start; i < end; i++) symmetryGroupEnd[i] = end;
            start = end;
        }
    }

    private record IndexedRequirement(int originalIndex, Requirement requirement) { }
    private static Choice remap(Choice choice, int requirementIndex) {
        return new Choice(choice.memberId, choice.employeeKey, choice.workloadKey, choice.optionId,
                choice.optionSortOrder, choice.start, choice.end, requirementIndex,
                choice.hardConflictMinutes, choice.softConflictMinutes, choice.payload);
    }

    List<Requirement> requirements() { return requirements; }

    private static List<Employee> reduceProvenEmployeeSymmetry(List<Employee> source, int maximumUsefulEmployees) {
        List<Employee> result = new ArrayList<>();
        java.util.Map<List<ChoiceSignature>, List<Employee>> groups = new java.util.TreeMap<>(DayConfigCoverageSearch::compareLists);
        for (Employee employee : source) groups.computeIfAbsent(signature(employee), ignored -> new ArrayList<>()).add(employee);
        for (List<Employee> group : groups.values()) {
            group.sort(Comparator.comparing((Employee e) -> e.choices.isEmpty() ? new EmployeeKey("", e.memberId)
                    : e.choices.get(0).employeeKey).thenComparingLong(Employee::memberId));
            result.addAll(group.subList(0, Math.min(maximumUsefulEmployees, group.size())));
        }
        return List.copyOf(result);
    }

    private static List<ChoiceSignature> signature(Employee employee) {
        return employee.choices.stream().map(ChoiceSignature::of).sorted().toList();
    }

    private record ChoiceSignature(WorkloadKey workload, long optionId, int optionSortOrder,
                                   int start, int end, int requirementIndex, long hard, long soft)
            implements Comparable<ChoiceSignature> {
        static ChoiceSignature of(Choice choice) {
            return new ChoiceSignature(choice.workloadKey, choice.optionId, choice.optionSortOrder,
                    choice.start, choice.end, choice.requirementIndex,
                    choice.hardConflictMinutes, choice.softConflictMinutes);
        }
        @Override public int compareTo(ChoiceSignature other) {
            int value = workload.compareTo(other.workload);
            if (value == 0) value = Long.compare(optionId, other.optionId);
            if (value == 0) value = Integer.compare(optionSortOrder, other.optionSortOrder);
            if (value == 0) value = Integer.compare(start, other.start);
            if (value == 0) value = Integer.compare(end, other.end);
            if (value == 0) value = Integer.compare(requirementIndex, other.requirementIndex);
            if (value == 0) value = Long.compare(hard, other.hard);
            if (value == 0) value = Long.compare(soft, other.soft);
            return value;
        }
    }

    Solution solve() {
        dfs(0, new int[requirements.size()][aggregateCapacity.length], new int[aggregateCapacity.length],
                new ArrayList<>(), 0, 0);
        Statistics stats = new Statistics(visited, branches, coveragePrunes);
        int unfilled = stableUnfilled(best.choices);
        return new Solution(best.choices, best.uncoveredDemandMinutes, best.hardConflictMinutes,
                best.softConflictMinutes, best.distinctEmployeeCount, unfilled, stats);
    }

    private void dfs(int employeeIndex, int[][] covered, int[] assigned, List<Choice> selected,
                     long hard, long soft) {
        visited++;
        consider(covered, selected, hard, soft);
        if (employeeIndex == employees.size()) return;
        if (best != null && optimisticUncovered(employeeIndex, covered) > best.uncoveredDemandMinutes) {
            coveragePrunes++;
            return;
        }
        Employee employee = employees.get(employeeIndex);
        for (Choice choice : employee.choices.stream().sorted(GEOMETRY).toList()) {
            branches++;
            if (!fits(choice, covered, assigned)) continue;
            apply(choice, covered, assigned, 1);
            selected.add(choice);
            dfs(employeeIndex + 1, covered, assigned, selected,
                    hard + choice.hardConflictMinutes, soft + choice.softConflictMinutes);
            selected.remove(selected.size() - 1);
            apply(choice, covered, assigned, -1);
        }
        branches++;
        // Equivalent employees have identical future business choices. If this representative
        // is skipped, any solution using a later representative has the same upper quality and
        // a worse technical employee vector, so the remainder of this group is symmetric.
        dfs(symmetryGroupEnd[employeeIndex], covered, assigned, selected, hard, soft);
    }

    private boolean fits(Choice choice, int[][] covered, int[] assigned) {
        Requirement requirement = requirements.get(choice.requirementIndex);
        if (choice.start < requirement.start || choice.end > requirement.end || choice.start >= choice.end) return false;
        for (int s = 0; s < aggregateCapacity.length; s++) if (inside(s, choice.start, choice.end)) {
            if (assigned[s] >= aggregateCapacity[s]
                    || covered[choice.requirementIndex][s] >= requirementCapacity[choice.requirementIndex][s]) return false;
        }
        return true;
    }

    private void apply(Choice choice, int[][] covered, int[] assigned, int delta) {
        for (int s = 0; s < aggregateCapacity.length; s++) if (inside(s, choice.start, choice.end)) {
            assigned[s] += delta;
            covered[choice.requirementIndex][s] += delta;
        }
    }

    private void consider(int[][] covered, List<Choice> selected, long hard, long soft) {
        long uncovered = uncovered(covered);
        Solution candidate = new Solution(List.copyOf(selected), uncovered, hard, soft,
                selected.size(), 0, null);
        if (best == null || compare(candidate, best) < 0) best = candidate;
    }

    private long uncovered(int[][] covered) {
        long result = 0;
        for (int r = 0; r < requirements.size(); r++) for (int s = 0; s < aggregateCapacity.length; s++) {
            result += (long) (requirementCapacity[r][s] - covered[r][s]) * (boundaries[s + 1] - boundaries[s]);
        }
        return result;
    }

    private long optimisticUncovered(int employeeIndex, int[][] covered) {
        int[][] possible = copy(covered);
        for (int e = employeeIndex; e < employees.size(); e++) for (Choice choice : employees.get(e).choices) {
            for (int s = 0; s < aggregateCapacity.length; s++) if (inside(s, choice.start, choice.end)) {
                possible[choice.requirementIndex][s] = Math.min(requirementCapacity[choice.requirementIndex][s],
                        possible[choice.requirementIndex][s] + 1);
            }
        }
        return uncovered(possible);
    }

    private int stableUnfilled(List<Choice> choices) {
        int result = 0;
        for (int r = 0; r < requirements.size(); r++) {
            List<Choice> pieces = new ArrayList<>();
            for (Choice choice : choices) if (choice.requirementIndex == r) pieces.add(choice);
            result += requirements.get(r).count - maximumCompleteUnits(requirements.get(r), pieces);
        }
        return result;
    }

    // Accounting normalization: maximize complete interchangeable units for fixed physical pieces.
    private int maximumCompleteUnits(Requirement requirement, List<Choice> pieces) {
        boolean[][] lanes = new boolean[requirement.count][aggregateCapacity.length];
        return placeForComplete(requirement, pieces, 0, lanes, 0);
    }

    private int placeForComplete(Requirement requirement, List<Choice> pieces, int index,
                                 boolean[][] lanes, int bestComplete) {
        if (index == pieces.size()) {
            int complete = 0;
            for (boolean[] lane : lanes) {
                boolean full = true;
                for (int s = 0; s < aggregateCapacity.length; s++)
                    if (inside(s, requirement.start, requirement.end) && !lane[s]) full = false;
                if (full) complete++;
            }
            return Math.max(bestComplete, complete);
        }
        Choice piece = pieces.get(index);
        Set<String> seenLaneShapes = new HashSet<>();
        for (boolean[] lane : lanes) {
            String shape = Arrays.toString(lane);
            if (!seenLaneShapes.add(shape) || overlaps(lane, piece)) continue;
            mark(lane, piece, true);
            bestComplete = placeForComplete(requirement, pieces, index + 1, lanes, bestComplete);
            mark(lane, piece, false);
        }
        return bestComplete;
    }

    private boolean overlaps(boolean[] lane, Choice piece) {
        for (int s = 0; s < lane.length; s++) if (inside(s, piece.start, piece.end) && lane[s]) return true;
        return false;
    }
    private void mark(boolean[] lane, Choice piece, boolean value) {
        for (int s = 0; s < lane.length; s++) if (inside(s, piece.start, piece.end)) lane[s] = value;
    }

    static int compare(Solution left, Solution right) {
        int value = Long.compare(left.uncoveredDemandMinutes, right.uncoveredDemandMinutes);
        if (value == 0) value = Long.compare(left.hardConflictMinutes, right.hardConflictMinutes);
        if (value == 0) value = Long.compare(left.softConflictMinutes, right.softConflictMinutes);
        if (value == 0) value = Integer.compare(left.distinctEmployeeCount, right.distinctEmployeeCount);
        if (value == 0) value = compareLists(workloads(left), workloads(right));
        if (value == 0) value = compareLists(employeeKeys(left), employeeKeys(right));
        if (value == 0) value = compareGeometry(left.choices, right.choices);
        return value;
    }

    private static List<WorkloadKey> workloads(Solution solution) {
        return solution.choices.stream().map(Choice::workloadKey).sorted(Comparator.reverseOrder()).toList();
    }
    private static List<EmployeeKey> employeeKeys(Solution solution) {
        return solution.choices.stream().map(Choice::employeeKey).distinct().sorted().toList();
    }
    private static <T extends Comparable<T>> int compareLists(List<T> left, List<T> right) {
        for (int i = 0; i < Math.min(left.size(), right.size()); i++) {
            int value = left.get(i).compareTo(right.get(i)); if (value != 0) return value;
        }
        return Integer.compare(left.size(), right.size());
    }
    private static int compareGeometry(List<Choice> left, List<Choice> right) {
        List<Choice> l = left.stream().sorted(GEOMETRY).toList(), r = right.stream().sorted(GEOMETRY).toList();
        for (int i = 0; i < Math.min(l.size(), r.size()); i++) {
            int value = GEOMETRY.compare(l.get(i), r.get(i)); if (value != 0) return value;
        }
        return Integer.compare(l.size(), r.size());
    }
    private static final Comparator<Choice> GEOMETRY = Comparator.comparingInt(Choice::requirementIndex)
            .thenComparingInt(Choice::start).thenComparingInt(Choice::end)
            .thenComparingInt(Choice::optionSortOrder).thenComparingLong(Choice::optionId)
            .thenComparingLong(Choice::memberId);

    private boolean inside(int segment, int start, int end) {
        return boundaries[segment] >= start && boundaries[segment + 1] <= end;
    }
    private static int[][] copy(int[][] source) {
        int[][] result = new int[source.length][];
        for (int i = 0; i < source.length; i++) result[i] = source[i].clone();
        return result;
    }
    private static int[] boundaries(List<Requirement> requirements, List<Employee> employees) {
        return java.util.stream.Stream.concat(
                requirements.stream().flatMapToInt(r -> java.util.stream.IntStream.of(r.start, r.end)).boxed(),
                employees.stream().flatMap(e -> e.choices.stream())
                        .flatMapToInt(c -> java.util.stream.IntStream.of(c.start, c.end)).boxed())
                .mapToInt(Integer::intValue).distinct().sorted().toArray();
    }
}
