package ru.staffly.schedule.service;

import org.springframework.stereotype.Component;
import ru.staffly.dictionary.model.Position;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Side-effect-free comparison of persisted template semantics with a proposed update. */
@Component
public class ScheduleBuildTemplateChangeClassifier {

    public ScheduleBuildTemplateChangeImpact classify(
            ScheduleBuildTemplate current,
            SaveScheduleBuildTemplateRequest proposed
    ) {
        ScheduleBuildTemplateChangeImpact impact = ScheduleBuildTemplateChangeImpact.NONE;
        if (!Objects.equals(normalizeText(current.getName()), normalizeText(proposed.name()))
                || !Objects.equals(normalizeText(current.getDescription()), normalizeText(proposed.description()))) {
            impact = impact.combine(ScheduleBuildTemplateChangeImpact.NEUTRAL_METADATA);
        }

        Map<List<Long>, ConfigGroup> currentConfigs = currentConfigs(current);
        Map<List<Long>, ConfigGroup> proposedConfigs = proposedConfigs(proposed);
        if (!currentConfigs.keySet().equals(proposedConfigs.keySet())) {
            return impact.combine(ScheduleBuildTemplateChangeImpact.PREFERENCE_AFFECTING);
        }

        for (List<Long> positions : currentConfigs.keySet()) {
            ConfigGroup before = currentConfigs.get(positions);
            ConfigGroup after = proposedConfigs.get(positions);
            if (!before.preferences().equals(after.preferences())) {
                impact = impact.combine(ScheduleBuildTemplateChangeImpact.PREFERENCE_AFFECTING);
            }
            if (!before.plannerConfigs().equals(after.plannerConfigs())) {
                impact = impact.combine(ScheduleBuildTemplateChangeImpact.PLANNER_AFFECTING);
            }
            if (!before.fullConfigs().equals(after.fullConfigs())) {
                impact = impact.combine(ScheduleBuildTemplateChangeImpact.NEUTRAL_METADATA);
            }
        }
        return impact;
    }

    private Map<List<Long>, ConfigGroup> currentConfigs(ScheduleBuildTemplate template) {
        Map<List<Long>, List<ConfigSnapshot>> grouped = new LinkedHashMap<>();
        for (ScheduleBuildPositionConfig config : safe(template.getPositionConfigs())) {
            grouped.computeIfAbsent(positionIds(config.getPositions()), ignored -> new ArrayList<>())
                    .add(snapshot(config));
        }
        return configGroups(grouped);
    }

    private Map<List<Long>, ConfigGroup> proposedConfigs(SaveScheduleBuildTemplateRequest request) {
        Map<List<Long>, List<ConfigSnapshot>> grouped = new LinkedHashMap<>();
        List<SaveScheduleBuildPositionConfigRequest> configs = safe(request.positionConfigs());
        for (int index = 0; index < configs.size(); index++) {
            SaveScheduleBuildPositionConfigRequest config = configs.get(index);
            if (config != null) {
                grouped.computeIfAbsent(ids(config.positionIds()), ignored -> new ArrayList<>())
                        .add(snapshot(config, index));
            }
        }
        return configGroups(grouped);
    }

    private Map<List<Long>, ConfigGroup> configGroups(Map<List<Long>, List<ConfigSnapshot>> grouped) {
        return grouped.entrySet().stream().collect(Collectors.toMap(
                Map.Entry::getKey,
                entry -> ConfigGroup.of(entry.getValue()),
                (left, right) -> { throw new IllegalStateException("Duplicate grouped position set"); },
                LinkedHashMap::new
        ));
    }

    private ConfigSnapshot snapshot(ScheduleBuildPositionConfig config) {
        List<ScheduleBuildShiftOption> options = safe(config.getShiftOptions());
        Preference preference = new Preference(config.getWorkPeriodStart(), config.getWorkPeriodEnd(),
                multiset(options.stream().map(o -> new ShiftGeometry(o.getStartTime(), o.getEndTime())).toList()));
        Planner planner = new Planner(config.getTargetPattern() == null ? ScheduleBuildPattern.NONE : config.getTargetPattern(), config.getMinRestHours(),
                config.getMinRestMode() == null ? ScheduleBuildMinRestMode.SOFT : config.getMinRestMode(),
                config.getMaxShiftsPerPeriod(), sorted(config.getHeavyDaysOfWeek()), defaultOrder(config.getSortOrder(), 0),
                multiset(options.stream().map(o -> new OrderedShift(o.getStartTime(), o.getEndTime(), o.getSortOrder())).toList()),
                multiset(safe(config.getCoverageRules()).stream().map(r -> new Coverage(
                        r.getDayOfWeek(), r.getStartTime(), r.getEndTime(), r.getRequiredCount(), r.getSortOrder())).toList()),
                multiset(safe(config.getCoverageDateOverrides()).stream().map(o -> new Override(
                        o.getDate(), optionRef(o.getShiftOption()), o.getRequiredCount())).toList()));
        return new ConfigSnapshot(preference, planner, labels(options));
    }

    private ConfigSnapshot snapshot(SaveScheduleBuildPositionConfigRequest config, int configIndex) {
        List<SaveScheduleBuildShiftOptionRequest> options = safe(config.shiftOptions());
        Preference preference = new Preference(config.workPeriodStart(), config.workPeriodEnd(),
                multiset(options.stream().map(o -> new ShiftGeometry(o.startTime(), o.endTime())).toList()));
        Planner planner = new Planner(
                config.targetPattern() == null ? ScheduleBuildPattern.NONE : config.targetPattern(),
                config.minRestHours(), config.minRestMode() == null ? ScheduleBuildMinRestMode.SOFT : config.minRestMode(),
                config.maxShiftsPerPeriod(), sorted(config.heavyDaysOfWeek()), defaultOrder(config.sortOrder(), configIndex),
                indexed(options, (o, index) -> new OrderedShift(o.startTime(), o.endTime(), defaultOrder(o.sortOrder(), index))),
                indexed(safe(config.coverageRules()), (r, index) -> new Coverage(r.dayOfWeek(), r.startTime(),
                        r.endTime(), r.requiredCount(), defaultOrder(r.sortOrder(), index))),
                multiset(safe(config.coverageDateOverrides()).stream().map(o -> new Override(o.date(),
                        requestOptionRef(options, o.shiftOptionIndex()), o.requiredCount())).toList()));
        return new ConfigSnapshot(preference, planner, requestLabels(options));
    }

    private OverrideReference requestOptionRef(List<SaveScheduleBuildShiftOptionRequest> options, Integer index) {
        if (index == null || index < 0 || index >= options.size()) return null;
        SaveScheduleBuildShiftOptionRequest option = options.get(index);
        return new OverrideReference(option.startTime(), option.endTime());
    }

    private OverrideReference optionRef(ScheduleBuildShiftOption option) {
        return option == null ? null : new OverrideReference(option.getStartTime(), option.getEndTime());
    }

    private Map<LabelKey, Long> labels(List<ScheduleBuildShiftOption> options) {
        return multiset(options.stream().map(o -> new LabelKey(o.getStartTime(), o.getEndTime(), o.getSortOrder(),
                normalizeText(o.getLabel()))).toList());
    }

    private Map<LabelKey, Long> requestLabels(List<SaveScheduleBuildShiftOptionRequest> options) {
        return indexedList(options, (o, index) -> new LabelKey(o.startTime(), o.endTime(),
                defaultOrder(o.sortOrder(), index), normalizeText(o.label())));
    }

    private static List<Long> positionIds(Collection<Position> positions) {
        return positions == null ? List.of() : positions.stream().map(Position::getId).filter(Objects::nonNull).sorted().toList();
    }

    private static List<Long> ids(List<Long> values) {
        return safe(values).stream().filter(Objects::nonNull).distinct().sorted().toList();
    }

    private static List<Integer> sorted(List<Integer> values) {
        return safe(values).stream().filter(Objects::nonNull).distinct().sorted().toList();
    }

    private static String normalizeText(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static int defaultOrder(Integer order, int fallback) {
        return order == null ? fallback : order;
    }

    private static <T> List<T> safe(List<T> values) { return values == null ? List.of() : values; }

    private static <T> Map<T, Long> multiset(List<T> values) {
        return values.stream().collect(Collectors.groupingBy(Function.identity(), HashMap::new, Collectors.counting()));
    }

    private static <T, R> Map<R, Long> indexed(List<T> values, IndexedMapper<T, R> mapper) {
        return multiset(indexedValues(values, mapper));
    }

    private static <T, R> Map<R, Long> indexedList(List<T> values, IndexedMapper<T, R> mapper) {
        return multiset(indexedValues(values, mapper));
    }

    private static <T, R> List<R> indexedValues(List<T> values, IndexedMapper<T, R> mapper) {
        List<R> result = new ArrayList<>();
        for (int i = 0; i < values.size(); i++) result.add(mapper.map(values.get(i), i));
        return result;
    }

    private interface IndexedMapper<T, R> { R map(T value, int index); }
    private record ShiftGeometry(LocalTime start, LocalTime end) {}
    private record OrderedShift(LocalTime start, LocalTime end, Integer order) {}
    private record OverrideReference(LocalTime start, LocalTime end) {}
    private record LabelKey(LocalTime start, LocalTime end, Integer order, String label) {}
    private record Coverage(Integer weekday, LocalTime start, LocalTime end, Integer count, Integer order) {}
    private record Override(LocalDate date, OverrideReference option, Integer count) {}
    private record Preference(LocalTime workStart, LocalTime workEnd, Map<ShiftGeometry, Long> shifts) {}
    private record Planner(ScheduleBuildPattern pattern, Integer minRestHours, ScheduleBuildMinRestMode minRestMode,
                           Integer maxShifts, List<Integer> heavyDays, Integer configOrder,
                           Map<OrderedShift, Long> shifts, Map<Coverage, Long> coverage,
                           Map<Override, Long> overrides) {}
    private record ConfigSnapshot(Preference preference, Planner planner, Map<LabelKey, Long> labels) {}
    private record PlannerConfig(Preference preference, Planner planner) {}
    private record FullConfig(Preference preference, Planner planner, Map<LabelKey, Long> labels) {}
    private record ConfigGroup(Map<Preference, Long> preferences,
                               Map<PlannerConfig, Long> plannerConfigs,
                               Map<FullConfig, Long> fullConfigs) {
        private static ConfigGroup of(List<ConfigSnapshot> configs) {
            return new ConfigGroup(
                    multiset(configs.stream().map(ConfigSnapshot::preference).toList()),
                    multiset(configs.stream().map(c -> new PlannerConfig(c.preference(), c.planner())).toList()),
                    multiset(configs.stream().map(c -> new FullConfig(c.preference(), c.planner(), c.labels())).toList())
            );
        }
    }
}
