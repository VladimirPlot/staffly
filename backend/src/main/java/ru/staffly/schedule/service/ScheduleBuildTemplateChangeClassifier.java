package ru.staffly.schedule.service;

import org.springframework.stereotype.Component;
import ru.staffly.dictionary.model.Position;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Side-effect-free, persistence-identity-free comparison of template semantics. */
@Component
public class ScheduleBuildTemplateChangeClassifier {
    public ScheduleBuildTemplateChangeImpact classify(ScheduleBuildTemplate current, SaveScheduleBuildTemplateRequest proposed) {
        ScheduleBuildTemplateChangeImpact impact = Objects.equals(text(current.getName()), text(proposed.name()))
                && Objects.equals(text(current.getDescription()), text(proposed.description()))
                ? ScheduleBuildTemplateChangeImpact.NONE : ScheduleBuildTemplateChangeImpact.NEUTRAL_METADATA;
        Map<List<Long>, Snapshot> before = current.getPositionConfigs().stream().collect(Collectors.toMap(
                c -> positionIds(c.getPositions()), this::snapshot, (a,b) -> a));
        Map<List<Long>, Snapshot> after = safe(proposed.positionConfigs()).stream().filter(Objects::nonNull)
                .collect(Collectors.toMap(c -> ids(c.positionIds()), this::snapshot, (a,b) -> a));
        if (!before.keySet().equals(after.keySet())) return impact.combine(ScheduleBuildTemplateChangeImpact.PREFERENCE_AFFECTING);
        for (List<Long> key : before.keySet()) {
            Snapshot a = before.get(key), b = after.get(key);
            if (!a.preference.equals(b.preference)) impact = impact.combine(ScheduleBuildTemplateChangeImpact.PREFERENCE_AFFECTING);
            if (!a.planner.equals(b.planner)) impact = impact.combine(ScheduleBuildTemplateChangeImpact.PLANNER_AFFECTING);
            if (!a.labels.equals(b.labels)) impact = impact.combine(ScheduleBuildTemplateChangeImpact.NEUTRAL_METADATA);
        }
        return impact;
    }

    private Snapshot snapshot(ScheduleBuildPositionConfig c) {
        Set<String> preference = c.getWeekdayRegimes().stream().map(r -> regimePreference(
                r.getDaysOfWeek(), r.getWorkPeriodStart(), r.getWorkPeriodEnd(),
                r.getShiftOptions().stream().map(o -> key(o.getStartTime(), o.getEndTime())).toList())).collect(Collectors.toSet());
        Set<String> regimePlanner = c.getWeekdayRegimes().stream().map(r -> regimePlanner(
                r.getDaysOfWeek(), r.getShiftOptions().stream().map(o -> key(o.getStartTime(), o.getEndTime(), o.getSortOrder())).toList(),
                r.getCoverageRules().stream().map(o -> key(o.getDayOfWeek(), o.getStartTime(), o.getEndTime(), o.getRequiredCount(), o.getSortOrder())).toList(),
                r.getCoverageDateOverrides().stream().map(o -> key(o.getDate(), ref(o.getShiftOption()), o.getRequiredCount())).toList())).collect(Collectors.toSet());
        String planner = key(c.getTargetPattern(), c.getMinRestHours(), c.getMinRestMode(), c.getMaxShiftsPerPeriod(),
                sorted(c.getHeavyDaysOfWeek()), c.getSortOrder(), regimePlanner);
        Map<String,Long> labels = bag(c.getWeekdayRegimes().stream().flatMap(r -> r.getShiftOptions().stream())
                .map(o -> key(days(o.getWeekdayRegime().getDaysOfWeek()), o.getStartTime(), o.getEndTime(), o.getSortOrder(), text(o.getLabel()))).toList());
        return new Snapshot(preference, planner, labels);
    }

    private Snapshot snapshot(SaveScheduleBuildPositionConfigRequest c) {
        List<SaveScheduleBuildWeekdayRegimeRequest> regimes = safe(c.weekdayRegimes());
        Set<String> preference = regimes.stream().map(r -> regimePreference(r.daysOfWeek(), r.workPeriodStart(), r.workPeriodEnd(),
                safe(r.shiftOptions()).stream().map(o -> key(o.startTime(), o.endTime())).toList())).collect(Collectors.toSet());
        Set<String> regimePlanner = regimes.stream().map(r -> regimePlanner(r.daysOfWeek(), indexed(r.shiftOptions(), o -> key(o.startTime(), o.endTime(), o.sortOrder())),
                indexed(r.coverageRules(), o -> key(o.dayOfWeek(), o.startTime(), o.endTime(), o.requiredCount(), o.sortOrder())),
                safe(r.coverageDateOverrides()).stream().map(o -> key(o.date(), requestRef(r, o.shiftOptionIndex()), o.requiredCount())).toList())).collect(Collectors.toSet());
        String planner = key(c.targetPattern(), c.minRestHours(), c.minRestMode(), c.maxShiftsPerPeriod(), sorted(c.heavyDaysOfWeek()), c.sortOrder(), regimePlanner);
        Map<String,Long> labels = bag(regimes.stream().flatMap(r -> safe(r.shiftOptions()).stream().map(o ->
                key(days(r.daysOfWeek()), o.startTime(), o.endTime(), o.sortOrder(), text(o.label())))).toList());
        return new Snapshot(preference, planner, labels);
    }

    private String regimePreference(Collection<java.time.DayOfWeek> days, Object start, Object end, List<String> shifts) {
        return key(days(days), start, end, shifts.stream().sorted().toList());
    }
    private String regimePlanner(Collection<java.time.DayOfWeek> days, List<String> shifts, List<String> coverage, List<String> overrides) {
        return key(days(days), shifts.stream().sorted().toList(), coverage.stream().sorted().toList(), overrides.stream().sorted().toList());
    }
    private String requestRef(SaveScheduleBuildWeekdayRegimeRequest r, Integer i) {
        List<SaveScheduleBuildShiftOptionRequest> options=safe(r.shiftOptions());
        return i == null || i < 0 || i >= options.size() ? null : key(options.get(i).startTime(), options.get(i).endTime(), options.get(i).sortOrder());
    }
    private String ref(ScheduleBuildShiftOption o) { return o == null ? null : key(o.getStartTime(), o.getEndTime(), o.getSortOrder()); }
    private static List<String> days(Collection<java.time.DayOfWeek> values) { return values == null ? List.of() : values.stream().filter(Objects::nonNull).map(Enum::name).sorted().toList(); }
    private static List<Long> positionIds(Collection<Position> p) { return p == null ? List.of() : p.stream().map(Position::getId).filter(Objects::nonNull).sorted().toList(); }
    private static List<Long> ids(List<Long> p) { return safe(p).stream().filter(Objects::nonNull).distinct().sorted().toList(); }
    private static List<Integer> sorted(List<Integer> p) { return safe(p).stream().filter(Objects::nonNull).distinct().sorted().toList(); }
    private static String text(String s) { return s == null || s.trim().isEmpty() ? null : s.trim(); }
    private static String key(Object... values) { return Arrays.deepToString(values); }
    private static <T> List<T> safe(List<T> v) { return v == null ? List.of() : v; }
    private static <T> Map<T,Long> bag(List<T> v) { return v.stream().collect(Collectors.groupingBy(Function.identity(), Collectors.counting())); }
    private static <T> List<String> indexed(List<T> v, Function<T,String> mapper) { return safe(v).stream().map(mapper).toList(); }
    private record Snapshot(Set<String> preference, String planner, Map<String,Long> labels) {}
}
