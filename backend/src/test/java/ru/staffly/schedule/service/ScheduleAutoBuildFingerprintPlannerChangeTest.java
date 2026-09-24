package ru.staffly.schedule.service;

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

    @Test
    void plannerAffectingCoverageChangeMakesExistingPreviewTokenStaleWithoutMutatingPreferenceInputs() {
        SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
        ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
        ScheduleAutoBuildFingerprintService fingerprints =
                new ScheduleAutoBuildFingerprintService(submissions, participations);
        Position position = Position.builder().id(20L).name("Cook").build();
        Schedule schedule = Schedule.builder().id(40L).version(7L)
                .status(ScheduleStatus.PREFERENCES_CLOSED)
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 1, 7))
                .shiftMode(ScheduleShiftMode.FULL)
                .positions(new LinkedHashSet<>(List.of(position)))
                .rows(new ArrayList<>()).build();
        ScheduleBuildTemplate template = template(position, 2);
        SchedulePreferenceShiftOptionSnapshot frozenVocabulary =
                SchedulePreferenceShiftOptionSnapshot.builder().id(70L).schedule(schedule)
                        .sourceShiftOptionId(101L).startTime(LocalTime.of(10, 0))
                        .endTime(LocalTime.of(18, 0)).sortOrder(0)
                        .positionIds(new LinkedHashSet<>(List.of(20L))).build();
        schedule.getPreferenceShiftOptionSnapshots().add(frozenVocabulary);
        when(participations.findByScheduleIdOrderById(40L)).thenReturn(List.of());
        when(submissions.findWithCellsByScheduleId(40L)).thenReturn(List.of());

        String previewToken = fingerprints.fingerprint(10L, schedule, template);
        template.getPositionConfigs().get(0).getCoverageRules().get(0).setRequiredCount(4);
        String currentToken = fingerprints.fingerprint(10L, schedule, template);

        assertThat(currentToken).isNotEqualTo(previewToken);
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.PREFERENCES_CLOSED);
        assertThat(schedule.getPreferenceShiftOptionSnapshots()).containsExactly(frozenVocabulary);
    }

    private ScheduleBuildTemplate template(Position position, int requiredCount) {
        ScheduleBuildTemplate template = ScheduleBuildTemplate.builder().id(60L)
                .name("Template").positionConfigs(new ArrayList<>()).build();
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder().id(80L).template(template)
                .positions(new LinkedHashSet<>(List.of(position)))
                .workPeriodStart(LocalTime.of(10, 0)).workPeriodEnd(LocalTime.of(20, 0))
                .targetPattern(ScheduleBuildPattern.NONE).minRestMode(ScheduleBuildMinRestMode.SOFT)
                .heavyDaysOfWeek(new ArrayList<>()).shiftOptions(new ArrayList<>())
                .coverageRules(new ArrayList<>()).coverageDateOverrides(new ArrayList<>()).sortOrder(0).build();
        ScheduleBuildShiftOption shift = ScheduleBuildShiftOption.builder().id(101L).positionConfig(config)
                .startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(18, 0)).sortOrder(0).build();
        ScheduleBuildCoverageRule coverage = ScheduleBuildCoverageRule.builder().id(102L).positionConfig(config)
                .dayOfWeek(1).startTime(LocalTime.of(10, 0)).endTime(LocalTime.of(18, 0))
                .requiredCount(requiredCount).sortOrder(0).build();
        config.getShiftOptions().add(shift);
        config.getCoverageRules().add(coverage);
        template.getPositionConfigs().add(config);
        return template;
    }
}
