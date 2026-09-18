package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildShiftOption;
import ru.staffly.schedule.model.ScheduleBuildTemplate;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ScheduleServicePreferenceTemplateCoverageTest {

    private static final Position WAITER = position(1L, "Официант");
    private static final Position BARTENDER = position(2L, "Бармен");
    private static final Position HOSTESS = position(3L, "Хостес");

    @Test
    void acceptsCompleteSinglePositionCoverage() {
        Schedule schedule = schedule(WAITER);
        ScheduleBuildTemplate template = template(config(List.of(WAITER), true));

        assertValid(schedule, template);
        ScheduleServiceImpl.replacePreferenceShiftOptionSnapshot(schedule, template);

        assertThat(schedule.getPreferenceShiftOptionSnapshots()).singleElement()
                .satisfies(snapshot -> assertThat(snapshot.getPositionIds()).containsExactly(WAITER.getId()));
    }

    @Test
    void rejectsPartialMultiPositionCoverageAndNamesMissingPosition() {
        assertThatThrownBy(() -> validate(schedule(WAITER, BARTENDER), template(config(List.of(WAITER), true))))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Выбранный шаблон не настроен для всех должностей графика: Бармен");
    }

    @Test
    void acceptsCompleteCoverageThroughSeparateConfigs() {
        assertValid(schedule(WAITER, BARTENDER), template(
                config(List.of(WAITER), true), config(List.of(BARTENDER), true)));
    }

    @Test
    void acceptsSharedMultiPositionConfig() {
        assertValid(schedule(WAITER, BARTENDER), template(config(List.of(WAITER, BARTENDER), true)));
    }

    @Test
    void allowsExtraTemplatePositions() {
        assertValid(schedule(WAITER), template(
                config(List.of(WAITER), true), config(List.of(BARTENDER), true)));
    }

    @Test
    void doesNotRequireScheduleRows() {
        Schedule schedule = schedule(WAITER);
        schedule.setRows(new ArrayList<>());

        assertValid(schedule, template(config(List.of(WAITER), true)));
    }

    @Test
    void rejectsDuplicatePositionOwnership() {
        assertThatThrownBy(() -> validate(schedule(WAITER), template(
                config(List.of(WAITER), true), config(List.of(WAITER), true))))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("В выбранном шаблоне несколько настроек для должностей графика: Официант");
    }

    @Test
    void rejectsMatchingConfigWithoutShiftOptions() {
        assertThatThrownBy(() -> validate(schedule(WAITER), template(config(List.of(WAITER), false))))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("В выбранном шаблоне нет вариантов смен для должностей графика: Официант");
    }

    @Test
    void reportsMultipleMissingPositionsInDeterministicNameOrder() {
        assertThatThrownBy(() -> validate(schedule(WAITER, HOSTESS, BARTENDER),
                template(config(List.of(WAITER), true))))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Выбранный шаблон не настроен для всех должностей графика: Бармен, Хостес");
    }

    private static void assertValid(Schedule schedule, ScheduleBuildTemplate template) {
        assertThatCode(() -> validate(schedule, template)).doesNotThrowAnyException();
    }

    private static void validate(Schedule schedule, ScheduleBuildTemplate template) {
        ScheduleServiceImpl.validatePreferenceTemplatePositionCoverage(schedule, template);
    }

    private static Schedule schedule(Position... positions) {
        return Schedule.builder().positions(new LinkedHashSet<>(List.of(positions))).build();
    }

    private static ScheduleBuildTemplate template(ScheduleBuildPositionConfig... configs) {
        return ScheduleBuildTemplate.builder().positionConfigs(new ArrayList<>(List.of(configs))).build();
    }

    private static ScheduleBuildPositionConfig config(List<Position> positions, boolean withShiftOption) {
        return ScheduleBuildPositionConfig.builder()
                .positions(new LinkedHashSet<>(positions))
                .shiftOptions(withShiftOption
                        ? new ArrayList<>(List.of(ScheduleBuildShiftOption.builder()
                                .id(1L)
                                .sortOrder(0)
                                .build()))
                        : new ArrayList<>())
                .build();
    }

    private static Position position(Long id, String name) {
        return Position.builder().id(id).name(name).build();
    }
}
