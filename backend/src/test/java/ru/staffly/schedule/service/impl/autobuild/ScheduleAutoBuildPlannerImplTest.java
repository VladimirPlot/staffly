package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildCoverageRule;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildShiftOption;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;
import ru.staffly.user.model.User;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScheduleAutoBuildPlannerImplTest {
    private static final LocalDate FRIDAY = LocalDate.of(2026, 7, 3);
    private static final LocalTime T10 = LocalTime.of(10, 0);
    private static final LocalTime T14 = LocalTime.of(14, 0);
    private static final LocalTime T17 = LocalTime.of(17, 0);
    private static final LocalTime T00 = LocalTime.MIDNIGHT;

    private final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    private final SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
    private final ScheduleAutoBuildPlannerImpl planner = new ScheduleAutoBuildPlannerImpl(members, submissions);

    @Test
    void keepsFullShiftNegativeFallbackWhenSplitCannotCoverRequiredHeadcountOnEverySlice() {
        RestaurantMember a = member(1, "A");
        RestaurantMember b = member(2, "B");
        RestaurantMember c = member(3, "C");
        ScheduleBuildTemplate template = template(3,
                option(1, T10, T17), option(2, T14, T00), option(3, T17, T00), option(4, T10, T00)
        );
        Schedule schedule = schedule();
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(eq(1L), anyList())).thenReturn(List.of(a, b, c));
        when(submissions.findWithCellsByScheduleId(schedule.getId())).thenReturn(List.of(
                submission(a, unavailableFullDay()), submission(b, unavailableFullDay())
        ));

        ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan plan = planner.build(1L, schedule, template);

        List<ScheduleAutoBuildPlanner.AssignmentPlan> cells = plan.positions().get(0).cells();
        assertThat(cells).hasSize(3);
        assertThat(cells).allSatisfy(cell -> assertThat(cell.startTime() + "-" + cell.endTime()).isEqualTo("10:00-00:00"));
        assertThat(cells).extracting(ScheduleAutoBuildPlanner.AssignmentPlan::matchStatus)
                .containsExactlyInAnyOrder("NO_PREFERENCE", "NEGATIVE_FALLBACK", "NEGATIVE_FALLBACK");
        assertThat(plan.uncoveredSlots()).isEmpty();
    }

    @Test
    void choosesPositiveSplitInsteadOfFullShiftWithOnlyPartialPositiveOverlap() {
        RestaurantMember a = member(1, "A");
        RestaurantMember b = member(2, "B");
        RestaurantMember c = member(3, "C");
        ScheduleBuildTemplate template = template(1, option(1, T10, T17), option(2, T17, T00), option(3, T10, T00));
        Schedule schedule = schedule();
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(eq(1L), anyList())).thenReturn(List.of(a, b, c));
        when(submissions.findWithCellsByScheduleId(schedule.getId())).thenReturn(List.of(
                submission(a, unavailableFullDay()),
                submission(b, available(T14, T00)),
                submission(c, available(T10, T17))
        ));

        ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan plan = planner.build(1L, schedule, template);

        assertThat(plan.positions().get(0).cells())
                .extracting(ScheduleAutoBuildPlanner.AssignmentPlan::memberId, ScheduleAutoBuildPlanner.AssignmentPlan::startTime,
                        ScheduleAutoBuildPlanner.AssignmentPlan::endTime, ScheduleAutoBuildPlanner.AssignmentPlan::matchStatus)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(3L, "10:00", "17:00", "EXACT_INTERVAL_PREFERENCE"),
                        org.assertj.core.groups.Tuple.tuple(2L, "17:00", "00:00", "COVERING_INTERVAL_PREFERENCE")
                );
        assertThat(plan.uncoveredSlots()).isEmpty();
    }

    @Test
    void prefersSingleNoPreferenceFullShiftOverPositiveSplit() {
        RestaurantMember a = member(1, "A");
        RestaurantMember b = member(2, "B");
        RestaurantMember c = member(3, "C");
        ScheduleBuildTemplate template = template(1, option(1, T10, T17), option(2, T17, T00), option(3, T10, T00));
        Schedule schedule = schedule();
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(eq(1L), anyList())).thenReturn(List.of(a, b, c));
        when(submissions.findWithCellsByScheduleId(schedule.getId())).thenReturn(List.of(
                submission(b, available(T10, T17)), submission(c, available(T17, T00))
        ));

        ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan plan = planner.build(1L, schedule, template);

        assertThat(plan.positions().get(0).cells()).hasSize(1);
        assertThat(plan.positions().get(0).cells().get(0).memberId()).isEqualTo(1L);
        assertThat(plan.positions().get(0).cells().get(0).matchStatus()).isEqualTo("NO_PREFERENCE");
    }

    @Test
    void positiveCompleteSplitReplacesSingleNegativeFallback() {
        RestaurantMember a = member(1, "A");
        RestaurantMember b = member(2, "B");
        RestaurantMember c = member(3, "C");
        ScheduleBuildTemplate template = template(1, option(1, T10, T17), option(2, T17, T00), option(3, T10, T00));
        Schedule schedule = schedule();
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(eq(1L), anyList())).thenReturn(List.of(a, b, c));
        when(submissions.findWithCellsByScheduleId(schedule.getId())).thenReturn(List.of(
                submission(a, unavailableFullDay()), submission(b, available(T10, T17)), submission(c, available(T17, T00))
        ));

        ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan plan = planner.build(1L, schedule, template);

        assertThat(plan.positions().get(0).cells()).hasSize(2);
        assertThat(plan.positions().get(0).cells()).extracting(ScheduleAutoBuildPlanner.AssignmentPlan::memberId)
                .containsExactlyInAnyOrder(2L, 3L);
    }

    @Test
    void incompleteSplitDoesNotReplaceSingleNegativeFallback() {
        RestaurantMember a = member(1, "A");
        RestaurantMember b = member(2, "B");
        ScheduleBuildTemplate template = template(1, option(1, T10, T17), option(2, T17, T00), option(3, T10, T00));
        Schedule schedule = schedule();
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(eq(1L), anyList())).thenReturn(List.of(a, b));
        when(submissions.findWithCellsByScheduleId(schedule.getId())).thenReturn(List.of(
                submission(a, unavailableFullDay()), submission(b, available(T10, T17))
        ));

        ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan plan = planner.build(1L, schedule, template);

        assertThat(plan.positions().get(0).cells()).hasSize(1);
        assertThat(plan.positions().get(0).cells().get(0).memberId()).isEqualTo(1L);
        assertThat(plan.positions().get(0).cells().get(0).matchStatus()).isEqualTo("NEGATIVE_FALLBACK");
        assertThat(plan.uncoveredSlots()).isEmpty();
    }


    @Test
    void marksPartialIntervalFallbackWhenAssignedShiftExceedsPositiveIntervalPreference() {
        RestaurantMember fullDay = member(1, "Full");
        RestaurantMember partial = member(2, "Partial");
        RestaurantMember negative = member(3, "Negative");
        ScheduleBuildTemplate template = template(3,
                option(1, T10, T17), option(2, T14, T00), option(3, T17, T00), option(4, T10, T00)
        );
        Schedule schedule = schedule();
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(eq(1L), anyList()))
                .thenReturn(List.of(fullDay, partial, negative));
        when(submissions.findWithCellsByScheduleId(schedule.getId())).thenReturn(List.of(
                submission(fullDay, availableFullDay()),
                submission(partial, available(T10, T17)),
                submission(negative, unavailableFullDay())
        ));

        ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan plan = planner.build(1L, schedule, template);

        assertThat(plan.positions().get(0).cells())
                .extracting(ScheduleAutoBuildPlanner.AssignmentPlan::memberId, ScheduleAutoBuildPlanner.AssignmentPlan::startTime,
                        ScheduleAutoBuildPlanner.AssignmentPlan::endTime, ScheduleAutoBuildPlanner.AssignmentPlan::matchStatus,
                        ScheduleAutoBuildPlanner.AssignmentPlan::warningMessage)
                .containsExactlyInAnyOrder(
                        org.assertj.core.groups.Tuple.tuple(1L, "10:00", "00:00", "FULL_DAY_POSITIVE", null),
                        org.assertj.core.groups.Tuple.tuple(2L, "10:00", "00:00", "PARTIAL_INTERVAL_FALLBACK",
                                "Назначение частично выходит за пределы пожелания сотрудника."),
                        org.assertj.core.groups.Tuple.tuple(3L, "10:00", "00:00", "NEGATIVE_FALLBACK",
                                "Сотрудник назначен несмотря на отрицательное пожелание, потому что не найдено альтернатив.")
                );
        assertThat(plan.positions().get(0).counters().warningsCount()).isEqualTo(2);
    }

    @Test
    void keepsCoveringIntervalPreferenceWhenPositiveIntervalContainsAssignedShift() {
        RestaurantMember member = member(1, "A");
        ScheduleBuildTemplate template = template(1, option(1, T17, T00));
        Schedule schedule = schedule();
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(eq(1L), anyList())).thenReturn(List.of(member));
        when(submissions.findWithCellsByScheduleId(schedule.getId())).thenReturn(List.of(submission(member, available(T14, T00))));

        ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan plan = planner.build(1L, schedule, template);

        assertThat(plan.positions().get(0).cells().get(0).matchStatus()).isEqualTo("COVERING_INTERVAL_PREFERENCE");
    }

    private static Schedule schedule() {
        return Schedule.builder().id(10L).startDate(FRIDAY).endDate(FRIDAY).positionIds(List.of(100L)).build();
    }

    private static ScheduleBuildTemplate template(int requiredCount, ScheduleBuildShiftOption... options) {
        Position position = Position.builder().id(100L).name("Официант").build();
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder()
                .id(200L).position(position).fullShiftStart(T10).fullShiftEnd(T00)
                .shiftOptions(List.of(options))
                .coverageRules(List.of(ScheduleBuildCoverageRule.builder()
                        .id(300L).dayOfWeek(FRIDAY.getDayOfWeek().getValue()).startTime(T10).endTime(T00).requiredCount(requiredCount).build()))
                .build();
        return ScheduleBuildTemplate.builder().id(400L).name("Template").positionConfigs(List.of(config)).build();
    }

    private static ScheduleBuildShiftOption option(long id, LocalTime start, LocalTime end) {
        return ScheduleBuildShiftOption.builder().id(id).startTime(start).endTime(end).label(start + "-" + end).build();
    }

    private static RestaurantMember member(long id, String name) {
        return RestaurantMember.builder().id(id).user(User.builder().firstName(name).lastName("Test").fullName(name + " Test").build()).build();
    }

    private static SchedulePreferenceSubmission submission(RestaurantMember member, SchedulePreferenceCell... cells) {
        return SchedulePreferenceSubmission.builder().member(member).cells(List.of(cells)).build();
    }

    private static SchedulePreferenceCell unavailableFullDay() {
        return SchedulePreferenceCell.builder().day(FRIDAY).type(SchedulePreferenceType.PREFER_DAY_OFF).fullDay(true).build();
    }

    private static SchedulePreferenceCell availableFullDay() {
        return SchedulePreferenceCell.builder().day(FRIDAY).type(SchedulePreferenceType.AVAILABLE).fullDay(true).build();
    }

    private static SchedulePreferenceCell available(LocalTime start, LocalTime end) {
        return SchedulePreferenceCell.builder().day(FRIDAY).type(SchedulePreferenceType.AVAILABLE).startTime(start).endTime(end).build();
    }
}
