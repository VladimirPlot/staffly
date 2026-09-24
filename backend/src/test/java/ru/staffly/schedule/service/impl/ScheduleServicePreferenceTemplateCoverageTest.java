package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildShiftOption;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleBuildWeekdayRegime;

import java.time.DayOfWeek;
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
    void createsPositionScopedSnapshotsForMultipleCompleteConfigs() {
        Schedule schedule = schedule(WAITER, BARTENDER);
        ScheduleBuildTemplate template = template(
                config(List.of(WAITER), true), config(List.of(BARTENDER), true));

        ScheduleServiceImpl.replacePreferenceShiftOptionSnapshot(schedule, template);

        assertThat(schedule.getPreferenceShiftOptionSnapshots()).hasSize(2);
        assertThat(schedule.getPreferenceShiftOptionSnapshots().get(0).getPositionIds()).containsExactly(WAITER.getId());
        assertThat(schedule.getPreferenceShiftOptionSnapshots().get(1).getPositionIds()).containsExactly(BARTENDER.getId());
    }

    @Test
    void freezesEachRegimeVocabularyWithItsNonContiguousBusinessWeekdays() {
        ScheduleBuildPositionConfig config = config(List.of(WAITER), true);
        ScheduleBuildWeekdayRegime first = config.getWeekdayRegimes().get(0);
        first.setDaysOfWeek(new LinkedHashSet<>(List.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY)));
        ScheduleBuildWeekdayRegime friday = regime(config, DayOfWeek.FRIDAY);
        friday.getShiftOptions().add(ScheduleBuildShiftOption.builder().id(2L).weekdayRegime(friday)
                .startTime(java.time.LocalTime.of(17, 0)).endTime(java.time.LocalTime.MIDNIGHT).sortOrder(0).build());
        config.getWeekdayRegimes().add(friday);
        Schedule schedule = schedule(WAITER);

        ScheduleServiceImpl.replacePreferenceShiftOptionSnapshot(schedule, template(config));

        assertThat(schedule.getPreferenceShiftOptionSnapshots()).hasSize(2);
        assertThat(schedule.getPreferenceShiftOptionSnapshots().get(0).getDaysOfWeek())
                .containsExactlyInAnyOrder(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY);
        assertThat(schedule.getPreferenceShiftOptionSnapshots().get(1).getDaysOfWeek())
                .containsExactly(DayOfWeek.FRIDAY);
    }

    @Test
    void frozenRegimeVocabularySurvivesLaterTemplateMutation() {
        ScheduleBuildPositionConfig config = config(List.of(WAITER), true);
        Schedule schedule = schedule(WAITER);
        ScheduleServiceImpl.replacePreferenceShiftOptionSnapshot(schedule, template(config));

        ScheduleBuildShiftOption liveOption = config.getWeekdayRegimes().get(0).getShiftOptions().get(0);
        liveOption.setStartTime(java.time.LocalTime.of(12, 0));
        liveOption.setLabel("Changed later");
        config.getWeekdayRegimes().get(0).setDaysOfWeek(new LinkedHashSet<>(List.of(DayOfWeek.FRIDAY)));

        assertThat(schedule.getPreferenceShiftOptionSnapshots()).singleElement().satisfies(snapshot -> {
            assertThat(snapshot.getStartTime()).isEqualTo(java.time.LocalTime.of(10, 0));
            assertThat(snapshot.getLabel()).isNull();
            assertThat(snapshot.getDaysOfWeek()).containsExactlyInAnyOrder(DayOfWeek.values());
        });
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
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder()
                .positions(new LinkedHashSet<>(positions))
                .build();
        ScheduleBuildWeekdayRegime regime = regime(config, DayOfWeek.values());
        if (withShiftOption) {
            regime.getShiftOptions().add(ScheduleBuildShiftOption.builder().id(1L).weekdayRegime(regime)
                    .startTime(java.time.LocalTime.of(10, 0)).endTime(java.time.LocalTime.of(17, 0))
                    .sortOrder(0).build());
        }
        config.getWeekdayRegimes().add(regime);
        return config;
    }

    private static ScheduleBuildWeekdayRegime regime(ScheduleBuildPositionConfig config, DayOfWeek... days) {
        return ScheduleBuildWeekdayRegime.builder().positionConfig(config)
                .daysOfWeek(new LinkedHashSet<>(List.of(days))).shiftOptions(new ArrayList<>()).sortOrder(0).build();
    }

    private static Position position(Long id, String name) {
        return Position.builder().id(id).name(name).build();
    }
}
