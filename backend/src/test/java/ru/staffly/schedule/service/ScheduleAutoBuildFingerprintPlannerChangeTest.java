package ru.staffly.schedule.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScheduleAutoBuildFingerprintPlannerChangeTest {
    private ScheduleAutoBuildFingerprintService fingerprints;

    @BeforeEach
    void setUp() {
        SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
        ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
        fingerprints = new ScheduleAutoBuildFingerprintService(submissions, participations);
        when(participations.findByScheduleIdOrderById(40L)).thenReturn(List.of());
        when(submissions.findWithCellsByScheduleId(40L)).thenReturn(List.of());
    }

    @Test
    void plannerAffectingCoverageChangeMakesExistingPreviewTokenStaleWithoutMutatingPreferenceInputs() {
        Fixture fixture = fixture();
        SchedulePreferenceShiftOptionSnapshot frozenVocabulary =
                SchedulePreferenceShiftOptionSnapshot.builder().id(70L).schedule(fixture.schedule())
                        .sourceShiftOptionId(20L).startTime(LocalTime.of(10, 0))
                        .endTime(LocalTime.of(17, 0)).sortOrder(0)
                        .positionIds(new LinkedHashSet<>(List.of(20L))).build();
        fixture.schedule().getPreferenceShiftOptionSnapshots().add(frozenVocabulary);

        String previewToken = fingerprint(fixture);
        fixture.coverage().setRequiredCount(4);

        assertThat(fingerprint(fixture)).isNotEqualTo(previewToken);
        assertThat(fixture.schedule().getStatus()).isEqualTo(ScheduleStatus.PREFERENCES_CLOSED);
        assertThat(fixture.schedule().getPreferenceShiftOptionSnapshots()).containsExactly(frozenVocabulary);
    }

    @Test
    void equivalentNestedEntitiesWithDifferentPersistenceIdsKeepFingerprint() {
        Fixture fixture = fixture();
        String before = fingerprint(fixture);

        fixture.config().setId(110L);
        fixture.shift().setId(120L);
        fixture.coverage().setId(130L);
        fixture.override().setId(140L);

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void recreatedShiftWithSameGeometryKeepsFingerprint() {
        Fixture fixture = fixture();
        String before = fingerprint(fixture);

        fixture.shift().setId(999L);

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void overridePointingToRecreatedEquivalentShiftKeepsFingerprint() {
        Fixture fixture = fixture();
        String before = fingerprint(fixture);
        ScheduleBuildShiftOption recreated = shift(fixture.config(), 999L, 10, 17, 0);
        fixture.config().getShiftOptions().set(0, recreated);
        fixture.override().setShiftOption(recreated);

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void changingOnlyOverrideTargetSemanticsChangesFingerprint() {
        Fixture fixture = fixture();
        ScheduleBuildShiftOption evening = shift(fixture.config(), 21L, 17, 0, 1);
        fixture.config().getShiftOptions().add(evening);
        String before = fingerprint(fixture);

        fixture.override().setShiftOption(evening);

        assertThat(fingerprint(fixture)).isNotEqualTo(before);
    }

    @Test
    void shiftGeometryChangeChangesFingerprint() {
        Fixture fixture = fixture();
        fixture.shift().setStartTime(LocalTime.of(17, 0));
        fixture.shift().setEndTime(LocalTime.MIDNIGHT);
        String before = fingerprint(fixture);

        fixture.shift().setStartTime(LocalTime.of(18, 0));

        assertThat(fingerprint(fixture)).isNotEqualTo(before);
    }

    @Test
    void displayMetadataChangesKeepFingerprint() {
        Fixture fixture = fixture();
        String before = fingerprint(fixture);

        fixture.template().setName("Renamed template");
        fixture.template().setDescription("New description");
        fixture.shift().setLabel("Visible label");

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void irrelevantCollectionIterationOrderKeepsFingerprint() {
        Fixture fixture = fixture();
        ScheduleBuildShiftOption evening = shift(fixture.config(), 21L, 17, 0, 1);
        fixture.config().getShiftOptions().add(evening);
        ScheduleBuildCoverageRule secondCoverage = coverage(fixture.config(), 31L, 2, 17, 0, 1, 1);
        fixture.config().getCoverageRules().add(secondCoverage);
        ScheduleBuildCoverageDateOverride secondOverride = override(fixture.config(), 41L,
                LocalDate.of(2026, 1, 3), evening, 1);
        fixture.config().getCoverageDateOverrides().add(secondOverride);
        fixture.config().getHeavyDaysOfWeek().addAll(List.of(5, 2));
        ScheduleBuildPositionConfig secondConfig = ScheduleBuildPositionConfig.builder().id(11L)
                .template(fixture.template()).positions(new LinkedHashSet<>(fixture.config().getPositions()))
                .workPeriodStart(LocalTime.of(8, 0)).workPeriodEnd(LocalTime.of(16, 0))
                .targetPattern(ScheduleBuildPattern.TWO_TWO).minRestMode(ScheduleBuildMinRestMode.SOFT)
                .heavyDaysOfWeek(new ArrayList<>()).shiftOptions(new ArrayList<>())
                .coverageRules(new ArrayList<>()).coverageDateOverrides(new ArrayList<>()).sortOrder(1).build();
        secondConfig.getShiftOptions().add(shift(secondConfig, 22L, 8, 16, 0));
        fixture.template().getPositionConfigs().add(secondConfig);
        String before = fingerprint(fixture);

        java.util.Collections.reverse(fixture.template().getPositionConfigs());
        java.util.Collections.reverse(fixture.config().getShiftOptions());
        java.util.Collections.reverse(fixture.config().getCoverageRules());
        java.util.Collections.reverse(fixture.config().getCoverageDateOverrides());
        java.util.Collections.reverse(fixture.config().getHeavyDaysOfWeek());

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void explicitShiftPlannerOrderChangesFingerprint() {
        Fixture fixture = fixture();
        String before = fingerprint(fixture);

        fixture.shift().setSortOrder(5);

        assertThat(fingerprint(fixture)).isNotEqualTo(before);
    }

    private String fingerprint(Fixture fixture) {
        return fingerprints.fingerprint(10L, fixture.schedule(), fixture.template());
    }

    private Fixture fixture() {
        Position position = Position.builder().id(20L).name("Cook").build();
        Schedule schedule = Schedule.builder().id(40L).version(7L)
                .status(ScheduleStatus.PREFERENCES_CLOSED)
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 1, 7))
                .shiftMode(ScheduleShiftMode.FULL)
                .positions(new LinkedHashSet<>(List.of(position)))
                .rows(new ArrayList<>()).build();
        ScheduleBuildTemplate template = ScheduleBuildTemplate.builder().id(60L)
                .name("Template").description("Description").positionConfigs(new ArrayList<>()).build();
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder().id(10L).template(template)
                .positions(new LinkedHashSet<>(List.of(position)))
                .workPeriodStart(LocalTime.of(10, 0)).workPeriodEnd(LocalTime.of(20, 0))
                .targetPattern(ScheduleBuildPattern.NONE).minRestMode(ScheduleBuildMinRestMode.SOFT)
                .heavyDaysOfWeek(new ArrayList<>()).shiftOptions(new ArrayList<>())
                .coverageRules(new ArrayList<>()).coverageDateOverrides(new ArrayList<>()).sortOrder(0).build();
        ScheduleBuildShiftOption shift = shift(config, 20L, 10, 17, 0);
        ScheduleBuildCoverageRule coverage = coverage(config, 30L, 1, 10, 17, 2, 0);
        ScheduleBuildCoverageDateOverride override = override(config, 40L,
                LocalDate.of(2026, 1, 2), shift, 3);
        config.getShiftOptions().add(shift);
        config.getCoverageRules().add(coverage);
        config.getCoverageDateOverrides().add(override);
        template.getPositionConfigs().add(config);
        return new Fixture(schedule, template, config, shift, coverage, override);
    }

    private ScheduleBuildShiftOption shift(ScheduleBuildPositionConfig config, long id,
                                           int startHour, int endHour, int sortOrder) {
        return ScheduleBuildShiftOption.builder().id(id).positionConfig(config)
                .startTime(LocalTime.of(startHour, 0)).endTime(LocalTime.of(endHour, 0))
                .label("Shift " + id).sortOrder(sortOrder).build();
    }

    private ScheduleBuildCoverageRule coverage(ScheduleBuildPositionConfig config, long id, int day,
                                                int startHour, int endHour, int count, int sortOrder) {
        return ScheduleBuildCoverageRule.builder().id(id).positionConfig(config).dayOfWeek(day)
                .startTime(LocalTime.of(startHour, 0)).endTime(LocalTime.of(endHour, 0))
                .requiredCount(count).sortOrder(sortOrder).build();
    }

    private ScheduleBuildCoverageDateOverride override(ScheduleBuildPositionConfig config, long id,
                                                        LocalDate date, ScheduleBuildShiftOption shift, int count) {
        return ScheduleBuildCoverageDateOverride.builder().id(id).positionConfig(config).date(date)
                .shiftOption(shift).requiredCount(count).build();
    }

    private record Fixture(Schedule schedule, ScheduleBuildTemplate template,
                           ScheduleBuildPositionConfig config, ScheduleBuildShiftOption shift,
                           ScheduleBuildCoverageRule coverage, ScheduleBuildCoverageDateOverride override) { }
}
