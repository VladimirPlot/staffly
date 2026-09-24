package ru.staffly.schedule.service;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.staffly.schedule.service.ScheduleBuildTemplateChangeImpact.*;

class ScheduleBuildTemplateChangeClassifierTest {
    private final ScheduleBuildTemplateChangeClassifier classifier = new ScheduleBuildTemplateChangeClassifier();

    @Test void identicalEffectiveTemplateIsNoneDespiteChildIds() {
        assertImpact(request(), NONE);
    }

    @Test void descriptionIsNeutral() { assertImpact(withTemplate("Template", "new"), NEUTRAL_METADATA); }
    @Test void nameIsNeutral() { assertImpact(withTemplate("Renamed", "Description"), NEUTRAL_METADATA); }
    @Test void shiftLabelIsNeutral() {
        assertImpact(withConfig(config(shifts(shift("Opening", 0)), coverage(2), overrides(3))), NEUTRAL_METADATA);
    }

    @Test void coverageCountIsPlannerAffecting() {
        assertImpact(withConfig(config(shifts(shift("Day", 0)), coverage(4), overrides(3))), PLANNER_AFFECTING);
    }

    @Test void minimumRestIsPlannerAffecting() {
        SaveScheduleBuildPositionConfigRequest c = config(shifts(shift("Day", 0)), coverage(2), overrides(3));
        assertImpact(withConfig(copy(c, c.workPeriodStart(), c.workPeriodEnd(), 12, c.shiftOptions(), c.coverageRules(), c.coverageDateOverrides())), PLANNER_AFFECTING);
    }

    @Test void overrideCountIsPlannerAffecting() {
        assertImpact(withConfig(config(shifts(shift("Day", 0)), coverage(2), overrides(5))), PLANNER_AFFECTING);
    }

    @Test void addingShiftIsPreferenceAffecting() {
        assertImpact(withConfig(config(shifts(shift("Day", 0), new SaveScheduleBuildShiftOptionRequest(t("17:00"), t("20:00"), "Late", 1)), coverage(2), overrides(3))), PREFERENCE_AFFECTING);
    }

    @Test void deletingShiftIsPreferenceAffecting() {
        assertImpact(withConfig(config(List.of(), coverage(2), List.of())), PREFERENCE_AFFECTING);
    }

    @Test void shiftStartIsPreferenceAffecting() {
        assertImpact(withConfig(config(shifts(new SaveScheduleBuildShiftOptionRequest(t("10:30"), t("17:00"), "Day", 0)), coverage(2), overrides(3))), PREFERENCE_AFFECTING);
    }

    @Test void collectedSeventeenToMidnightVocabularyChangingToEighteenIsPreferenceAffecting() {
        SaveScheduleBuildPositionConfigRequest currentBase = config(
                shifts(new SaveScheduleBuildShiftOptionRequest(t("17:00"), t("00:00"), "Evening", 0)),
                List.of(), List.of());
        SaveScheduleBuildPositionConfigRequest proposedBase = config(
                shifts(new SaveScheduleBuildShiftOptionRequest(t("18:00"), t("00:00"), "Evening", 0)),
                List.of(), List.of());
        SaveScheduleBuildPositionConfigRequest current = copy(currentBase, t("10:00"), t("00:00"), 8,
                currentBase.shiftOptions(), currentBase.coverageRules(), currentBase.coverageDateOverrides());
        SaveScheduleBuildPositionConfigRequest proposed = copy(proposedBase, t("10:00"), t("00:00"), 8,
                proposedBase.shiftOptions(), proposedBase.coverageRules(), proposedBase.coverageDateOverrides());

        assertThat(classifier.classify(template(List.of(current)), withConfig(proposed)))
                .isEqualTo(PREFERENCE_AFFECTING);
    }

    @Test void shiftEndIsPreferenceAffecting() {
        assertImpact(withConfig(config(shifts(new SaveScheduleBuildShiftOptionRequest(t("10:00"), t("18:00"), "Day", 0)), coverage(2), overrides(3))), PREFERENCE_AFFECTING);
    }

    @Test void workPeriodIsPreferenceAffecting() {
        SaveScheduleBuildPositionConfigRequest c = config(shifts(shift("Day", 0)), coverage(2), overrides(3));
        assertImpact(withConfig(copy(c, t("09:00"), c.workPeriodEnd(), 8, c.shiftOptions(), c.coverageRules(), c.coverageDateOverrides())), PREFERENCE_AFFECTING);
    }

    @Test void positionApplicabilityIsPreferenceAffecting() {
        SaveScheduleBuildPositionConfigRequest c = config(shifts(shift("Day", 0)), coverage(2), overrides(3));
        c = new SaveScheduleBuildPositionConfigRequest(List.of(20L), c.workPeriodStart(), c.workPeriodEnd(), c.targetPattern(),
                c.minRestHours(), c.minRestMode(), c.maxShiftsPerPeriod(), c.heavyDaysOfWeek(), c.shiftOptions(),
                c.coverageRules(), c.coverageDateOverrides(), c.sortOrder());
        assertImpact(withConfig(c), PREFERENCE_AFFECTING);
    }

    @Test void descriptionAndCoverageComposeToPlanner() {
        assertImpact(new SaveScheduleBuildTemplateRequest("Template", "new", true,
                List.of(config(shifts(shift("Day", 0)), coverage(4), overrides(3)))), PLANNER_AFFECTING);
    }

    @Test void coverageAndShiftTimeComposeToPreference() {
        assertImpact(withConfig(config(shifts(new SaveScheduleBuildShiftOptionRequest(t("10:30"), t("17:00"), "Day", 0)), coverage(4), overrides(3))), PREFERENCE_AFFECTING);
    }

    @Test void labelAndShiftTimeComposeToPreference() {
        assertImpact(withConfig(config(shifts(new SaveScheduleBuildShiftOptionRequest(t("10:30"), t("17:00"), "Renamed", 0)), coverage(2), overrides(3))), PREFERENCE_AFFECTING);
    }

    @Test void multipleConfigsWithSamePositionSetAreComparedWithoutLoss() {
        SaveScheduleBuildPositionConfigRequest first = configWithRestAndOrder(8, 0);
        SaveScheduleBuildPositionConfigRequest second = configWithRestAndOrder(12, 1);

        assertThat(classifier.classify(template(List.of(first, second)), withConfigs(first, second))).isEqualTo(NONE);
    }

    @Test void removingOneOfDuplicatePositionSetConfigsIsPreferenceAffecting() {
        SaveScheduleBuildPositionConfigRequest first = configWithRestAndOrder(8, 0);
        SaveScheduleBuildPositionConfigRequest second = configWithRestAndOrder(12, 1);

        assertThat(classifier.classify(template(List.of(first, second)), withConfigs(first)))
                .isEqualTo(PREFERENCE_AFFECTING);
    }

    @Test void changingOnlySecondDuplicatePositionSetConfigIsDetected() {
        SaveScheduleBuildPositionConfigRequest first = configWithRestAndOrder(8, 0);
        SaveScheduleBuildPositionConfigRequest second = configWithRestAndOrder(12, 1);
        SaveScheduleBuildPositionConfigRequest changedSecond = configWithRestAndOrder(16, 1);

        assertThat(classifier.classify(template(List.of(first, second)), withConfigs(first, changedSecond)))
                .isEqualTo(PLANNER_AFFECTING);
    }

    @Test void configCollectionOrderAloneIsIgnored() {
        SaveScheduleBuildPositionConfigRequest first = configWithRestAndOrder(8, 0);
        SaveScheduleBuildPositionConfigRequest second = configWithRestAndOrder(12, 1);

        assertThat(classifier.classify(template(List.of(first, second)), withConfigs(second, first))).isEqualTo(NONE);
    }

    @Test void identicalConfigMultiplicityIsPreserved() {
        SaveScheduleBuildPositionConfigRequest duplicate = configWithRestAndOrder(8, 0);

        assertThat(classifier.classify(template(List.of(duplicate, duplicate)), withConfigs(duplicate)))
                .isEqualTo(PREFERENCE_AFFECTING);
    }

    @Test void shiftSortOrderWithOverrideIsOnlyPlannerAffecting() {
        SaveScheduleBuildPositionConfigRequest proposed = config(
                shifts(shift("Day", 7)), coverage(2), overrides(3));

        assertImpact(withConfig(proposed), PLANNER_AFFECTING);
    }

    @Test void changingOverrideTargetGeometryIsPlannerAffecting() {
        List<SaveScheduleBuildShiftOptionRequest> options = shifts(
                shift("Day", 0),
                new SaveScheduleBuildShiftOptionRequest(t("17:00"), t("20:00"), "Late", 1));
        SaveScheduleBuildPositionConfigRequest current = config(options, coverage(2), overrides(3));
        SaveScheduleBuildPositionConfigRequest proposed = config(options, coverage(2),
                List.of(new SaveScheduleBuildCoverageDateOverrideRequest(LocalDate.of(2026, 10, 1), 1, 3)));

        assertThat(classifier.classify(template(List.of(current)), withConfig(proposed)))
                .isEqualTo(PLANNER_AFFECTING);
    }

    private void assertImpact(SaveScheduleBuildTemplateRequest request, ScheduleBuildTemplateChangeImpact expected) {
        assertThat(classifier.classify(template(), request)).isEqualTo(expected);
    }

    private static ScheduleBuildTemplate template() {
        return template(request().positionConfigs());
    }

    private static ScheduleBuildTemplate template(List<SaveScheduleBuildPositionConfigRequest> requests) {
        Position position = Position.builder().id(10L).build();
        List<ScheduleBuildPositionConfig> configs = new ArrayList<>();
        long childId = 100L;
        for (SaveScheduleBuildPositionConfigRequest request : requests) {
            ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder()
                    .id(childId++).positions(new LinkedHashSet<>(List.of(position)))
                    .workPeriodStart(request.workPeriodStart()).workPeriodEnd(request.workPeriodEnd())
                    .targetPattern(request.targetPattern()).minRestHours(request.minRestHours()).minRestMode(request.minRestMode())
                    .maxShiftsPerPeriod(request.maxShiftsPerPeriod())
                    .heavyDaysOfWeek(new ArrayList<>(request.heavyDaysOfWeek())).sortOrder(request.sortOrder()).build();
            List<ScheduleBuildShiftOption> options = new ArrayList<>();
            for (SaveScheduleBuildShiftOptionRequest shift : request.shiftOptions()) {
                options.add(ScheduleBuildShiftOption.builder().id(childId++).positionConfig(config)
                        .startTime(shift.startTime()).endTime(shift.endTime()).label(shift.label())
                        .sortOrder(shift.sortOrder()).build());
            }
            config.setShiftOptions(options);
            config.setCoverageRules(request.coverageRules().stream().map(rule -> ScheduleBuildCoverageRule.builder()
                    .id(200L + configs.size()).positionConfig(config).dayOfWeek(rule.dayOfWeek())
                    .startTime(rule.startTime()).endTime(rule.endTime()).requiredCount(rule.requiredCount())
                    .sortOrder(rule.sortOrder()).build()).collect(java.util.stream.Collectors.toCollection(ArrayList::new)));
            config.setCoverageDateOverrides(request.coverageDateOverrides().stream().map(override ->
                    ScheduleBuildCoverageDateOverride.builder().id(300L + configs.size()).positionConfig(config)
                            .date(override.date()).shiftOption(options.get(override.shiftOptionIndex()))
                            .requiredCount(override.requiredCount()).build())
                    .collect(java.util.stream.Collectors.toCollection(ArrayList::new)));
            configs.add(config);
        }
        return ScheduleBuildTemplate.builder().id(99L).name("Template").description("Description")
                .positionConfigs(configs).build();
    }

    private static SaveScheduleBuildTemplateRequest request() {
        return withConfig(config(shifts(shift("Day", 0)), coverage(2), overrides(3)));
    }
    private static SaveScheduleBuildTemplateRequest withTemplate(String name, String description) {
        return new SaveScheduleBuildTemplateRequest(name, description, true, request().positionConfigs());
    }
    private static SaveScheduleBuildTemplateRequest withConfig(SaveScheduleBuildPositionConfigRequest config) {
        return new SaveScheduleBuildTemplateRequest("Template", "Description", true, List.of(config));
    }
    private static SaveScheduleBuildTemplateRequest withConfigs(SaveScheduleBuildPositionConfigRequest... configs) {
        return new SaveScheduleBuildTemplateRequest("Template", "Description", true, List.of(configs));
    }
    private static SaveScheduleBuildPositionConfigRequest configWithRestAndOrder(int rest, int order) {
        SaveScheduleBuildPositionConfigRequest config = config(shifts(shift("Day", 0)), coverage(2), overrides(3));
        return new SaveScheduleBuildPositionConfigRequest(config.positionIds(), config.workPeriodStart(), config.workPeriodEnd(),
                config.targetPattern(), rest, config.minRestMode(), config.maxShiftsPerPeriod(), config.heavyDaysOfWeek(),
                config.shiftOptions(), config.coverageRules(), config.coverageDateOverrides(), order);
    }
    private static SaveScheduleBuildPositionConfigRequest config(List<SaveScheduleBuildShiftOptionRequest> shifts,
            List<SaveScheduleBuildCoverageRuleRequest> coverage, List<SaveScheduleBuildCoverageDateOverrideRequest> overrides) {
        return new SaveScheduleBuildPositionConfigRequest(List.of(10L), t("10:00"), t("20:00"), ScheduleBuildPattern.NONE,
                8, ScheduleBuildMinRestMode.SOFT, 5, List.of(6, 5), shifts, coverage, overrides, 0);
    }
    private static SaveScheduleBuildPositionConfigRequest copy(SaveScheduleBuildPositionConfigRequest c,
            LocalTime start, LocalTime end, Integer rest, List<SaveScheduleBuildShiftOptionRequest> shifts,
            List<SaveScheduleBuildCoverageRuleRequest> coverage, List<SaveScheduleBuildCoverageDateOverrideRequest> overrides) {
        return new SaveScheduleBuildPositionConfigRequest(c.positionIds(), start, end, c.targetPattern(), rest, c.minRestMode(),
                c.maxShiftsPerPeriod(), c.heavyDaysOfWeek(), shifts, coverage, overrides, c.sortOrder());
    }
    private static SaveScheduleBuildShiftOptionRequest shift(String label, Integer order) {
        return new SaveScheduleBuildShiftOptionRequest(t("10:00"), t("17:00"), label, order);
    }
    private static List<SaveScheduleBuildShiftOptionRequest> shifts(SaveScheduleBuildShiftOptionRequest... shifts) { return List.of(shifts); }
    private static List<SaveScheduleBuildCoverageRuleRequest> coverage(int count) {
        return List.of(new SaveScheduleBuildCoverageRuleRequest(1, t("10:00"), t("17:00"), count, 0));
    }
    private static List<SaveScheduleBuildCoverageDateOverrideRequest> overrides(int count) {
        return List.of(new SaveScheduleBuildCoverageDateOverrideRequest(LocalDate.of(2026, 10, 1), 0, count));
    }
    private static LocalTime t(String value) { return LocalTime.parse(value); }
}
