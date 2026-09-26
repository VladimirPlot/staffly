package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildCoverageRule;
import ru.staffly.schedule.model.ScheduleBuildMarker;
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
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.AssignmentPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan;
import ru.staffly.user.model.User;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScheduleAutoBuildPlannerMarkerTest {
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 14);
    private static final Position WAITER = position(10, "Waiter");
    private static final Position SENIOR_WAITER = position(11, "Senior waiter");
    private static final Position COOK = position(20, "Cook");

    @Test
    void buildPrefersEffectiveMarkerMemberOverEarlierTechnicalCandidate() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, WAITER);
        attachCoverage(fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture, 2));

        ScheduleAutoBuildPlan plan = build(fixture);

        assertComplete(plan, 1, 2L);
        assertEquals("2026-09-14:10:00-17:00", assignmentKey(plan.positions().get(0).cells().get(0)));
    }

    @Test
    void buildKeepsPreferenceQualityAboveMarkerAffinity() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, WAITER);
        attachCoverage(fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture, 2));
        prefer(fixture, fixture.member1(), MONDAY, SchedulePreferenceType.AVAILABLE);
        prefer(fixture, fixture.member2(), MONDAY, SchedulePreferenceType.UNAVAILABLE);

        assertComplete(build(fixture), 1, 1L);
    }

    @Test
    void buildKeepsMarkerAheadOfTargetAndWorkloadFairnessAcrossDays() {
        Fixture fixture = fixture(MONDAY, MONDAY.plusDays(1), List.of(WAITER), WAITER, WAITER);
        ScheduleBuildWeekdayRegime regime = attachCoverage(
                fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture, 2));
        addRule(regime, DayOfWeek.TUESDAY, "10:00", "17:00");

        ScheduleAutoBuildPlan plan = build(fixture);

        assertComplete(plan, 2, 2L, 2L);
        assertEquals(List.of(MONDAY.toString(), MONDAY.plusDays(1).toString()),
                cells(plan).stream().map(AssignmentPlan::day).toList());
    }

    @Test
    void buildDoesNotTreatEmptyMarkerAsEligibilityFilter() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, WAITER);
        attachCoverage(fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture));

        assertComplete(build(fixture), 1, 1L);
    }

    @Test
    void buildIgnoresStaleMarkerAffinity() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, COOK);
        attachCoverage(fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture, 2));

        assertComplete(build(fixture), 1, 1L);
    }

    @Test
    void buildKeepsHistoricalCandidateDespiteCurrentPositionOutsideBlock() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, COOK);
        attachCoverage(fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture, 2));
        prefer(fixture, fixture.member1(), MONDAY, SchedulePreferenceType.UNAVAILABLE);
        prefer(fixture, fixture.member2(), MONDAY, SchedulePreferenceType.AVAILABLE);

        assertComplete(build(fixture), 1, 2L);
    }

    @Test
    void buildKeepsMarkerAffinityWhenCurrentPositionMovesWithinBlock() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER, SENIOR_WAITER), WAITER, SENIOR_WAITER);
        attachCoverage(fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture, 2));

        assertComplete(build(fixture), 1, 2L);
    }

    @Test
    void buildUsesPerOptionMarkerAffinityForCompleteSplit() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, WAITER);
        ScheduleBuildShiftOption early = markedOption(1, "10:00", "17:00", fixture, 2);
        ScheduleBuildShiftOption late = markedOption(2, "17:00", "00:00", fixture, 1);
        attachCoverage(fixture, "10:00", "00:00", early, late);

        ScheduleAutoBuildPlan plan = build(fixture);

        assertEquals(2, plan.totalAssignments());
        assertEquals(0, plan.unfilledCount());
        assertTrue(plan.uncoveredSlots().isEmpty());
        assertEquals(List.of("2:10:00-17:00", "1:17:00-00:00"), cells(plan).stream()
                .sorted(java.util.Comparator.comparing(AssignmentPlan::startTime))
                .map(cell -> cell.memberId() + ":" + cell.startTime() + "-" + cell.endTime()).toList());
        assertEquals(2, cells(plan).stream().map(AssignmentPlan::memberId).distinct().count());
    }

    @Test
    void buildUsesMarkerInsideEqualNegativePreferenceFallback() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, WAITER);
        attachCoverage(fixture, "10:00", "17:00", markedOption(1, "10:00", "17:00", fixture, 2));
        prefer(fixture, fixture.member1(), MONDAY, SchedulePreferenceType.UNAVAILABLE);
        prefer(fixture, fixture.member2(), MONDAY, SchedulePreferenceType.UNAVAILABLE);

        ScheduleAutoBuildPlan plan = build(fixture);

        assertComplete(plan, 1, 2L);
        assertEquals(1, plan.negativeAssignmentsCount());
    }

    @Test
    void legacyNoCoverageStillUsesMarkerAffinity() {
        Fixture fixture = fixture(MONDAY, MONDAY, List.of(WAITER), WAITER, WAITER);
        ScheduleBuildShiftOption option = markedOption(1, "10:00", "17:00", fixture, 2);
        attachRegime(fixture, "10:00", "17:00", option);

        ScheduleAutoBuildPlan plan = build(fixture);

        assertEquals(1, plan.totalAssignments());
        assertEquals(List.of(2L), cells(plan).stream().map(AssignmentPlan::memberId).toList());
    }

    private static Fixture fixture(LocalDate start, LocalDate end, List<Position> blockPositions,
                                   Position member1Current, Position member2Current) {
        Schedule schedule = Schedule.builder().id(30L).startDate(start).endDate(end)
                .positions(new LinkedHashSet<>(List.of(WAITER))).build();
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder().id(20L)
                .positions(new LinkedHashSet<>(blockPositions)).maxShiftsPerPeriod(10)
                .weekdayRegimes(new ArrayList<>()).markers(new ArrayList<>()).heavyDaysOfWeek(new ArrayList<>()).build();
        ScheduleBuildTemplate template = ScheduleBuildTemplate.builder().id(40L).name("Marker regression")
                .positionConfigs(List.of(config)).build();
        config.setTemplate(template);
        RestaurantMember member1 = member(1, member1Current);
        RestaurantMember member2 = member(2, member2Current);
        List<ScheduleParticipation> participations = List.of(
                participation(schedule, member1, WAITER), participation(schedule, member2, WAITER));
        return new Fixture(schedule, config, template, member1, member2, participations, new ArrayList<>());
    }

    private static ScheduleBuildWeekdayRegime attachCoverage(Fixture fixture, String start, String end,
                                                               ScheduleBuildShiftOption... options) {
        ScheduleBuildWeekdayRegime regime = attachRegime(fixture, start, end, options);
        addRule(regime, DayOfWeek.MONDAY, start, end);
        return regime;
    }

    private static ScheduleBuildWeekdayRegime attachRegime(Fixture fixture, String start, String end,
                                                             ScheduleBuildShiftOption... options) {
        ScheduleBuildWeekdayRegime regime = ScheduleBuildWeekdayRegime.builder().id(50L)
                .positionConfig(fixture.config()).daysOfWeek(EnumSet.allOf(DayOfWeek.class))
                .workPeriodStart(time(start)).workPeriodEnd(time(end)).sortOrder(0)
                .shiftOptions(new ArrayList<>(List.of(options))).coverageRules(new ArrayList<>())
                .coverageDateOverrides(new ArrayList<>()).build();
        for (ScheduleBuildShiftOption option : options) option.setWeekdayRegime(regime);
        fixture.config().setWeekdayRegimes(List.of(regime));
        return regime;
    }

    private static void addRule(ScheduleBuildWeekdayRegime regime, DayOfWeek day, String start, String end) {
        regime.getCoverageRules().add(ScheduleBuildCoverageRule.builder().weekdayRegime(regime)
                .dayOfWeek(day.getValue()).startTime(time(start)).endTime(time(end))
                .requiredCount(1).sortOrder(0).build());
    }

    private static ScheduleBuildShiftOption markedOption(long id, String start, String end, Fixture fixture,
                                                           long... markedMemberIds) {
        ScheduleBuildMarker marker = ScheduleBuildMarker.builder().id(100L + id).name("Marker " + id)
                .positionConfig(fixture.config()).members(new LinkedHashSet<>()).build();
        for (long memberId : markedMemberIds)
            marker.getMembers().add(memberId == 1 ? fixture.member1() : fixture.member2());
        fixture.config().getMarkers().add(marker);
        return ScheduleBuildShiftOption.builder().id(id).label("Shift " + id).startTime(time(start))
                .endTime(time(end)).sortOrder((int) id).marker(marker).build();
    }

    private static ScheduleAutoBuildPlan build(Fixture fixture) {
        ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
        SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
        when(participations.findByScheduleIdOrderById(30L)).thenReturn(fixture.participations());
        when(submissions.findWithCellsByScheduleId(30L)).thenReturn(List.copyOf(fixture.submissions()));
        return new ScheduleAutoBuildPlannerImpl(submissions, participations)
                .build(1L, fixture.schedule(), fixture.template());
    }

    private static void prefer(Fixture fixture, RestaurantMember member, LocalDate day,
                               SchedulePreferenceType type) {
        SchedulePreferenceCell cell = SchedulePreferenceCell.builder().day(day).type(type).fullDay(true).build();
        SchedulePreferenceSubmission submission = SchedulePreferenceSubmission.builder()
                .schedule(fixture.schedule()).member(member).cells(List.of(cell)).build();
        cell.setSubmission(submission);
        fixture.submissions().add(submission);
    }

    private static void assertComplete(ScheduleAutoBuildPlan plan, int assignments, Long... memberIds) {
        assertEquals(assignments, plan.totalAssignments());
        assertEquals(0, plan.unfilledCount());
        assertTrue(plan.uncoveredSlots().isEmpty());
        assertEquals(List.of(memberIds), cells(plan).stream().map(AssignmentPlan::memberId).toList());
    }

    private static List<AssignmentPlan> cells(ScheduleAutoBuildPlan plan) {
        return plan.positions().get(0).cells();
    }

    private static String assignmentKey(AssignmentPlan assignment) {
        return assignment.day() + ":" + assignment.startTime() + "-" + assignment.endTime();
    }

    private static ScheduleParticipation participation(Schedule schedule, RestaurantMember member, Position snapshot) {
        return ScheduleParticipation.builder().schedule(schedule).member(member)
                .positionId(snapshot.getId()).positionName(snapshot.getName()).build();
    }

    private static RestaurantMember member(long id, Position currentPosition) {
        return RestaurantMember.builder().id(id).position(currentPosition)
                .user(User.builder().id(id).firstName("Member " + id).lastName("Tester")
                        .fullName("Member " + id + " Tester").build()).build();
    }

    private static Position position(long id, String name) {
        return Position.builder().id(id).name(name).build();
    }

    private static LocalTime time(String value) {
        return LocalTime.parse(value);
    }

    private record Fixture(Schedule schedule, ScheduleBuildPositionConfig config, ScheduleBuildTemplate template,
                           RestaurantMember member1, RestaurantMember member2,
                           List<ScheduleParticipation> participations,
                           List<SchedulePreferenceSubmission> submissions) { }
}
