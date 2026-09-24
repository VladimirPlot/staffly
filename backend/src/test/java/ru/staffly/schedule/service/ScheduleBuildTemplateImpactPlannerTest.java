package ru.staffly.schedule.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import ru.staffly.schedule.dto.SaveScheduleBuildTemplateRequest;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;
import static ru.staffly.schedule.service.ScheduleBuildTemplateChangeImpact.*;
import static ru.staffly.schedule.service.ScheduleBuildTemplateScheduleAction.*;

@ExtendWith(MockitoExtension.class)
class ScheduleBuildTemplateImpactPlannerTest {
    private static final Long RESTAURANT_ID = 7L;
    private static final Long TEMPLATE_ID = 41L;

    @Mock private ScheduleBuildTemplateChangeClassifier classifier;
    @Mock private ScheduleRepository schedules;

    private ScheduleBuildTemplateImpactPlanner planner;
    private ScheduleBuildTemplate template;
    private SaveScheduleBuildTemplateRequest request;

    @BeforeEach
    void setUp() {
        planner = new ScheduleBuildTemplateImpactPlanner(classifier, schedules);
        template = ScheduleBuildTemplate.builder().id(TEMPLATE_ID).name("Current").build();
        request = new SaveScheduleBuildTemplateRequest("Proposed", null, true, List.of());
    }

    @ParameterizedTest
    @EnumSource(value = ScheduleBuildTemplateChangeImpact.class, names = {"NONE", "NEUTRAL_METADATA"})
    void noneAndNeutralMetadataNeverActOnLinkedSchedules(ScheduleBuildTemplateChangeImpact impact) {
        given(impact, schedules(COLLECTING_PREFERENCES, PREFERENCES_CLOSED,
                DRAFT_FROM_PREFERENCES, PUBLISHED));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.impact()).isEqualTo(impact);
        assertThat(plan.schedules()).extracting(ScheduleBuildTemplateScheduleImpact::action)
                .containsOnly(NO_ACTION);
        assertThat(plan.hasDestructiveConsequences()).isFalse();
    }

    @Test
    void plannerChangesKeepCollectingAndClosedPreferences() {
        given(PLANNER_AFFECTING, schedules(COLLECTING_PREFERENCES, PREFERENCES_CLOSED));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.schedules()).extracting(ScheduleBuildTemplateScheduleImpact::action)
                .containsExactly(KEEP_PREFERENCES, KEEP_PREFERENCES);
        assertThat(plan.hasDestructiveConsequences()).isFalse();
    }

    @Test
    void plannerChangeInvalidatesOnlyAnAppliedAutoBuild() {
        given(PLANNER_AFFECTING, schedules(DRAFT_FROM_PREFERENCES));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.schedules().get(0).action()).isEqualTo(INVALIDATE_APPLIED_AUTO_BUILD);
        assertThat(plan.hasDestructiveConsequences()).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = ScheduleStatus.class,
            names = {"COLLECTING_PREFERENCES", "PREFERENCES_CLOSED", "DRAFT_FROM_PREFERENCES"})
    void preferenceChangeResetsEveryActivePreferenceLifecycleState(ScheduleStatus status) {
        given(PREFERENCE_AFFECTING, schedules(status));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.schedules().get(0).action()).isEqualTo(RESET_PREFERENCE_COLLECTION);
        assertThat(plan.hasDestructiveConsequences()).isTrue();
    }

    @Test
    void preferenceChangeDoesNothingToOrdinaryDraft() {
        given(PREFERENCE_AFFECTING, schedules(DRAFT));

        assertThat(planner.plan(RESTAURANT_ID, template, request).schedules().get(0).action())
                .isEqualTo(NO_ACTION);
    }

    @ParameterizedTest
    @EnumSource(value = ScheduleBuildTemplateChangeImpact.class,
            names = {"PLANNER_AFFECTING", "PREFERENCE_AFFECTING"})
    void publishedScheduleIsExplicitlyUnchanged(ScheduleBuildTemplateChangeImpact impact) {
        given(impact, schedules(PUBLISHED));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.schedules().get(0).action()).isEqualTo(PUBLISHED_UNCHANGED);
        assertThat(plan.hasDestructiveConsequences()).isFalse();
    }

    @Test
    void mixedSchedulesHaveExactActionsAndSummaryDerivedFromItems() {
        given(PREFERENCE_AFFECTING, schedules(DRAFT, COLLECTING_PREFERENCES,
                PREFERENCES_CLOSED, DRAFT_FROM_PREFERENCES, PUBLISHED));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.schedules()).extracting(ScheduleBuildTemplateScheduleImpact::action)
                .containsExactly(NO_ACTION, RESET_PREFERENCE_COLLECTION, RESET_PREFERENCE_COLLECTION,
                        RESET_PREFERENCE_COLLECTION, PUBLISHED_UNCHANGED);
        assertThat(plan.summary()).isEqualTo(new ScheduleBuildTemplateImpactSummary(5, 1, 0, 0, 3, 1));
    }

    @Test
    void planIsReadOnlyAndDelegatesClassificationExactlyOnce() {
        Schedule linked = schedule(1L, DRAFT_FROM_PREFERENCES);
        linked.setPreferenceCollectionCycle(3);
        List<?> rowsBefore = new ArrayList<>(linked.getRows());
        given(PLANNER_AFFECTING, List.of(linked));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.impact()).isEqualTo(PLANNER_AFFECTING);
        assertThat(template.getName()).isEqualTo("Current");
        assertThat(request.name()).isEqualTo("Proposed");
        assertThat(linked.getStatus()).isEqualTo(DRAFT_FROM_PREFERENCES);
        assertThat(linked.getPreferenceCollectionCycle()).isEqualTo(3);
        assertThat(linked.getRows()).containsExactlyElementsOf(rowsBefore);
        verify(classifier).classify(template, request);
        verify(schedules).findByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(RESTAURANT_ID, TEMPLATE_ID);
        verifyNoMoreInteractions(classifier, schedules);
    }

    @Test
    void repositoryLookupIsScopedByBothRestaurantAndTemplate() {
        Schedule local = schedule(1L, COLLECTING_PREFERENCES);
        given(PLANNER_AFFECTING, List.of(local));

        ScheduleBuildTemplateImpactPlan plan = planner.plan(RESTAURANT_ID, template, request);

        assertThat(plan.schedules()).extracting(ScheduleBuildTemplateScheduleImpact::scheduleId)
                .containsExactly(1L);
        verify(schedules).findByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(
                RESTAURANT_ID, TEMPLATE_ID);
        verify(schedules, never()).save(any());
        verify(schedules, never()).saveAndFlush(any());
        verify(schedules, never()).delete(any());
        verify(schedules, never()).flush();
    }

    private void given(ScheduleBuildTemplateChangeImpact impact, List<Schedule> linkedSchedules) {
        when(classifier.classify(template, request)).thenReturn(impact);
        when(schedules.findByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(RESTAURANT_ID, TEMPLATE_ID))
                .thenReturn(linkedSchedules);
    }

    private static List<Schedule> schedules(ScheduleStatus... statuses) {
        List<Schedule> result = new ArrayList<>();
        for (int i = 0; i < statuses.length; i++) {
            result.add(schedule((long) i + 1, statuses[i]));
        }
        return result;
    }

    private static Schedule schedule(Long id, ScheduleStatus status) {
        return Schedule.builder().id(id).title("Schedule " + id).status(status).build();
    }
}
