package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAutoBuildFingerprintService;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;
import ru.staffly.security.SecurityService;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleAutoBuildTemplateResolutionTest {

    @Mock private SecurityService securityService;
    @Mock private ScheduleAccessService scheduleAccessService;
    @Mock private ScheduleRepository schedules;
    @Mock private ScheduleBuildTemplateRepository templates;
    @Mock private ScheduleAutoBuildPlanner planner;
    @Mock private ScheduleAutoBuildFingerprintService fingerprintService;

    private ScheduleAutoBuildPreviewServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ScheduleAutoBuildPreviewServiceImpl(
                securityService, scheduleAccessService, schedules, templates, planner, fingerprintService);
    }

    @Test
    void rejectsScheduleWithoutPreferenceCollectionMode() {
        Schedule schedule = Schedule.builder().preferenceCollectionMode(null).build();

        assertThatThrownBy(() -> service.resolveEffectiveTemplate(1L, schedule, 10L))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Автосборка доступна только после проведения сбора пожеланий");
    }

    @Test
    void dayLevelMayUseAnyRequestedValidTemplate() {
        Schedule schedule = Schedule.builder().preferenceCollectionMode(PreferenceCollectionMode.DAY_LEVEL).build();
        ScheduleBuildTemplate templateA = ScheduleBuildTemplate.builder().id(10L).build();
        ScheduleBuildTemplate templateB = ScheduleBuildTemplate.builder().id(20L).build();
        when(templates.findDetailedByIdAndRestaurantIdAndIsActiveTrue(10L, 1L)).thenReturn(Optional.of(templateA));
        when(templates.findDetailedByIdAndRestaurantIdAndIsActiveTrue(20L, 1L)).thenReturn(Optional.of(templateB));

        assertThat(service.resolveEffectiveTemplate(1L, schedule, 10L)).isSameAs(templateA);
        assertThat(service.resolveEffectiveTemplate(1L, schedule, 20L)).isSameAs(templateB);
    }

    @Test
    void shiftOptionsAcceptsCollectionTemplateAndRejectsAnotherTemplate() {
        ScheduleBuildTemplate templateA = ScheduleBuildTemplate.builder().id(10L).build();
        Schedule schedule = Schedule.builder()
                .preferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS)
                .preferenceBuildTemplate(templateA)
                .build();
        when(templates.findDetailedByIdAndRestaurantIdAndIsActiveTrue(10L, 1L)).thenReturn(Optional.of(templateA));

        assertThat(service.resolveEffectiveTemplate(1L, schedule, 10L)).isSameAs(templateA);
        assertThatThrownBy(() -> service.resolveEffectiveTemplate(1L, schedule, 20L))
                .isInstanceOf(BadRequestException.class);
    }
}
