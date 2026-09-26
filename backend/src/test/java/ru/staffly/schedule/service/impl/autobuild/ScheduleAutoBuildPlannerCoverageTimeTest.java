package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.CanonicalBusinessInterval;
import ru.staffly.schedule.model.CanonicalBusinessIntervalResolver;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildCoverageRule;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildShiftOption;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleBuildWeekdayRegime;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan;
import ru.staffly.user.model.User;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScheduleAutoBuildPlannerCoverageTimeTest {
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 14);

    @Test
    void buildsOvernightSplitInCanonicalCoordinates() {
        ScheduleAutoBuildPlan plan = build("10:00", "06:00", "18:00", "06:00",
                option("18:00", "00:00", 1), option("00:00", "06:00", 2));

        assertComplete(plan, 2);
        assertCoordinates("10:00", "06:00", "18:00", "06:00", 1080, 1800);
        assertCoordinates("10:00", "06:00", "18:00", "00:00", 1080, 1440);
        assertCoordinates("10:00", "06:00", "00:00", "06:00", 1440, 1800);
    }

    @Test
    void buildsLateNightSubsetAsACompleteSingleOption() {
        ScheduleAutoBuildPlan plan = build("10:00", "06:00", "00:00", "06:00",
                option("00:00", "06:00", 1));

        assertComplete(plan, 1);
        assertCoordinates("10:00", "06:00", "00:00", "06:00", 1440, 1800);
    }

    @Test
    void doesNotCommitTransactionalPartialSplitAcrossAnOvernightGap() {
        ScheduleAutoBuildPlan plan = build("10:00", "06:00", "18:00", "06:00",
                option("18:00", "00:00", 1), option("01:00", "06:00", 2));

        assertEquals(2, plan.totalAssignments());
        assertEquals(1, plan.unfilledCount());
        assertEquals(1, plan.uncoveredSlots().size());
        assertEquals("00:00", plan.uncoveredSlots().get(0).startTime());
        assertEquals("01:00", plan.uncoveredSlots().get(0).endTime());
    }

    @Test
    void treatsOverlappingOvernightOptionsAsCompleteCoverage() {
        ScheduleAutoBuildPlan plan = build("10:00", "06:00", "18:00", "06:00",
                option("18:00", "02:00", 1), option("00:00", "06:00", 2));

        assertComplete(plan, 2);
    }

    @Test
    void preservesSameDayContiguousSplit() {
        ScheduleAutoBuildPlan plan = build("10:00", "18:00", "10:00", "18:00",
                option("10:00", "14:00", 1), option("14:00", "18:00", 2));

        assertComplete(plan, 2);
    }

    @Test
    void transitionalNonNegativeSplitFiltersNegativeWinnerBeforeSelectingAllowedFallback() {
        // Step 3A characterization: whole-solution ordering remains deferred to Step 3B.
        Position position = Position.builder().id(10L).name("Cook").build();
        Schedule schedule = Schedule.builder()
                .id(30L)
                .startDate(MONDAY)
                .endDate(MONDAY)
                .positions(new LinkedHashSet<>(List.of(position)))
                .build();
        List<RestaurantMember> candidates = List.of(
                member(1L, "Available first", position),
                member(2L, "Partial second", position),
                member(3L, "Soft negative", position)
        );
        ScheduleBuildTemplate template = template(
                "Transitional preference filtering",
                position,
                "10:00",
                "00:00",
                "10:00",
                "00:00",
                option("10:00", "17:00", 1),
                option("17:00", "00:00", 2)
        );
        SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
        ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
        when(participations.findByScheduleIdOrderById(30L)).thenReturn(candidates.stream()
                .map(candidate -> ScheduleParticipation.builder()
                        .schedule(schedule)
                        .member(candidate)
                        .positionId(10L)
                        .positionName("Cook")
                        .build())
                .toList());
        when(submissions.findWithCellsByScheduleId(30L)).thenReturn(List.of(
                submission(schedule, candidates.get(0), intervalPreference("10:00", "17:00")),
                submission(schedule, candidates.get(1), intervalPreference("17:00", "22:00")),
                submission(schedule, candidates.get(2), fullDayPreference(SchedulePreferenceType.PREFER_DAY_OFF))
        ));

        ScheduleAutoBuildPlan plan = new ScheduleAutoBuildPlannerImpl(submissions, participations)
                .build(1L, schedule, template);

        assertEquals(List.of(1L, 2L), plan.positions().get(0).cells().stream()
                .map(assignment -> assignment.memberId())
                .toList());
        assertEquals(List.of("10:00", "17:00"), plan.positions().get(0).cells().stream()
                .map(assignment -> assignment.startTime())
                .toList());
        assertEquals(List.of("17:00", "00:00"), plan.positions().get(0).cells().stream()
                .map(assignment -> assignment.endTime())
                .toList());
    }

    @Test
    void keepsOneMinuteCanonicalGapUncovered() {
        ScheduleAutoBuildPlan plan = build("10:00", "06:00", "18:00", "06:00",
                option("18:00", "00:00", 1), option("00:01", "06:00", 2));

        assertEquals(2, plan.totalAssignments());
        assertEquals(1, plan.unfilledCount());
        assertEquals(1, plan.uncoveredSlots().size());
        assertEquals("00:00", plan.uncoveredSlots().get(0).startTime());
        assertEquals("00:01", plan.uncoveredSlots().get(0).endTime());
    }

    @Test
    void convertsCrossMidnightCanonicalGapToWallClockDisplay() {
        ScheduleAutoBuildPlan plan = build("10:00", "06:00", "23:00", "01:00");

        assertEquals(0, plan.totalAssignments());
        assertEquals(1, plan.unfilledCount());
        assertEquals(1, plan.uncoveredSlots().size());
        assertEquals("23:00", plan.uncoveredSlots().get(0).startTime());
        assertEquals("01:00", plan.uncoveredSlots().get(0).endTime());
    }

    @Test
    void buildsSplitInsideTwentyFourHourPeriodAnchoredAtTen() {
        ScheduleAutoBuildPlan plan = build("10:00", "10:00", "18:00", "06:00",
                option("18:00", "00:00", 1), option("00:00", "06:00", 2));

        assertComplete(plan, 2);
    }

    @Test
    void supportsCalendarDayBoundaryAndPreservesResolverRejection() {
        ScheduleAutoBuildPlan plan = build("00:00", "00:00", "18:00", "00:00",
                option("18:00", "00:00", 1));

        assertComplete(plan, 1);
        CanonicalBusinessInterval workPeriod = workPeriod("00:00", "00:00");
        assertThrows(IllegalArgumentException.class,
                () -> CanonicalBusinessIntervalResolver.resolveInside(workPeriod, time("18:00"), time("06:00")));
    }

    private static void assertComplete(ScheduleAutoBuildPlan plan, int assignmentCount) {
        assertEquals(assignmentCount, plan.totalAssignments());
        assertEquals(0, plan.unfilledCount());
        assertEquals(List.of(), plan.uncoveredSlots());
    }

    private static void assertCoordinates(
            String workStart, String workEnd, String start, String end, int expectedStart, int expectedEnd
    ) {
        CanonicalBusinessInterval interval = CanonicalBusinessIntervalResolver.resolveInside(
                workPeriod(workStart, workEnd), time(start), time(end));
        assertEquals(expectedStart, interval.startMinute());
        assertEquals(expectedEnd, interval.endMinute());
    }

    private static ScheduleAutoBuildPlan build(
            String workStart,
            String workEnd,
            String coverageStart,
            String coverageEnd,
            ScheduleBuildShiftOption... options
    ) {
        Position position = Position.builder().id(10L).name("Cook").build();
        Schedule schedule = Schedule.builder()
                .id(30L)
                .startDate(MONDAY)
                .endDate(MONDAY)
                .positions(new LinkedHashSet<>(List.of(position)))
                .build();
        ScheduleBuildTemplate template = template(
                "Canonical coverage", position, workStart, workEnd, coverageStart, coverageEnd, options);

        SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
        ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
        List<RestaurantMember> candidates = List.of(
                member(1L, "One", position), member(2L, "Two", position), member(3L, "Three", position));
        when(participations.findByScheduleIdOrderById(30L)).thenReturn(candidates.stream()
                .map(candidate -> ScheduleParticipation.builder()
                        .schedule(schedule)
                        .member(candidate)
                        .positionId(10L)
                        .positionName("Cook")
                        .build())
                .toList());
        when(submissions.findWithCellsByScheduleId(30L)).thenReturn(List.of());

        return new ScheduleAutoBuildPlannerImpl(submissions, participations).build(1L, schedule, template);
    }

    private static RestaurantMember member(Long id, String name, Position position) {
        return RestaurantMember.builder()
                .id(id)
                .position(position)
                .user(User.builder().id(id).firstName(name).lastName("Tester").fullName(name + " Tester").build())
                .build();
    }

    private static ScheduleBuildTemplate template(
            String name,
            Position position,
            String workStart,
            String workEnd,
            String coverageStart,
            String coverageEnd,
            ScheduleBuildShiftOption... options
    ) {
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder()
                .id(20L)
                .positions(new LinkedHashSet<>(List.of(position)))
                .build();
        ScheduleBuildCoverageRule rule = ScheduleBuildCoverageRule.builder()
                .dayOfWeek(MONDAY.getDayOfWeek().getValue())
                .startTime(time(coverageStart))
                .endTime(time(coverageEnd))
                .requiredCount(1)
                .build();
        ScheduleBuildWeekdayRegime regime = ScheduleBuildWeekdayRegime.builder()
                .positionConfig(config)
                .daysOfWeek(EnumSet.allOf(DayOfWeek.class))
                .workPeriodStart(time(workStart))
                .workPeriodEnd(time(workEnd))
                .sortOrder(0)
                .shiftOptions(List.of(options))
                .coverageRules(List.of(rule))
                .coverageDateOverrides(List.of())
                .build();
        config.setWeekdayRegimes(List.of(regime));
        rule.setWeekdayRegime(regime);
        for (ScheduleBuildShiftOption option : options) {
            option.setWeekdayRegime(regime);
        }
        ScheduleBuildTemplate template = ScheduleBuildTemplate.builder()
                .id(40L)
                .name(name)
                .positionConfigs(List.of(config))
                .build();
        config.setTemplate(template);
        return template;
    }

    private static SchedulePreferenceSubmission submission(
            Schedule schedule,
            RestaurantMember member,
            SchedulePreferenceCell cell
    ) {
        SchedulePreferenceSubmission submission = SchedulePreferenceSubmission.builder()
                .schedule(schedule)
                .member(member)
                .cells(List.of(cell))
                .build();
        cell.setSubmission(submission);
        return submission;
    }

    private static SchedulePreferenceCell intervalPreference(String start, String end) {
        return SchedulePreferenceCell.builder()
                .day(MONDAY)
                .type(SchedulePreferenceType.AVAILABLE)
                .startTime(time(start))
                .endTime(time(end))
                .build();
    }

    private static SchedulePreferenceCell fullDayPreference(SchedulePreferenceType type) {
        return SchedulePreferenceCell.builder()
                .day(MONDAY)
                .type(type)
                .fullDay(true)
                .build();
    }

    private static ScheduleBuildShiftOption option(String start, String end, int order) {
        return ScheduleBuildShiftOption.builder()
                .id((long) order)
                .startTime(time(start))
                .endTime(time(end))
                .sortOrder(order)
                .build();
    }

    private static CanonicalBusinessInterval workPeriod(String start, String end) {
        return CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(time(start), time(end));
    }

    private static LocalTime time(String value) {
        return LocalTime.parse(value);
    }
}
