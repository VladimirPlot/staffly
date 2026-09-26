package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.CanonicalBusinessInterval;
import ru.staffly.schedule.model.CanonicalBusinessIntervalResolver;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildCoverageDateOverride;
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
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

class ScheduleAutoBuildPlannerTargetTest {
    private static final LocalDate MONDAY = LocalDate.of(2026, 9, 14);
    private static final Position POSITION = Position.builder().id(10L).name("Cook").build();

    @Test
    void resolvesWeeklyOverrideZeroOverrideAndOutOfPeriodDemandThroughBuild() {
        Observation weekly = build(singleRegimeFixture(MONDAY, MONDAY.plusDays(7), 2, null, 2));
        assertTarget(weekly, 4, 2);

        Observation replacement = build(singleRegimeFixture(MONDAY, MONDAY.plusDays(7), 2, 4, 2));
        assertTarget(replacement, 6, 2);

        Fixture zeroFixture = singleRegimeFixture(MONDAY, MONDAY.plusDays(7), 2, 0, 2);
        addOverride(zeroFixture.regimes().get(0), MONDAY.plusDays(14), 9);
        Observation zeroReplacement = build(zeroFixture);
        assertTarget(zeroReplacement, 2, 2);
        assertTrue(zeroReplacement.plan().positions().get(0).cells().stream()
                .noneMatch(cell -> cell.day().equals(MONDAY.plusDays(7).toString())));
    }

    @Test
    void selectsTheEffectiveRegimeForEachBusinessDate() {
        Fixture fixture = fixture(MONDAY.plusDays(3), MONDAY.plusDays(4), 3);
        ScheduleBuildWeekdayRegime first = regime(EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY,
                DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.SUNDAY));
        addRule(first, DayOfWeek.THURSDAY, 2, "10:00", "17:00");
        ScheduleBuildWeekdayRegime second = regime(EnumSet.of(DayOfWeek.FRIDAY, DayOfWeek.SATURDAY));
        addRule(second, DayOfWeek.FRIDAY, 3, "10:00", "17:00");
        addRule(second, DayOfWeek.SATURDAY, 7, "10:00", "17:00");
        fixture.attach(List.of(first, second));

        assertTarget(build(fixture), 5, 3);
    }

    @Test
    void targetPopulationPrecedesDailyAvailabilityAndSearchReduction() {
        Fixture available = dailyFixture(MONDAY, 1, 3);
        assertTarget(build(available), 1, 3);

        Fixture unavailable = dailyFixture(MONDAY, 1, 3);
        unavailable.submissions().add(submission(unavailable.schedule(), unavailable.members().get(2),
                fullDay(MONDAY, SchedulePreferenceType.UNAVAILABLE)));
        Observation observed = build(unavailable);
        assertTarget(observed, 1, 3);
        assertEquals(List.of(1L, 2L, 3L), observed.candidateIds());
    }

    @Test
    void balancesFourRealAssignmentsAcrossTwoMembers() {
        Fixture fixture = dailyFixture(MONDAY, 4, 2);
        Observation observed = build(fixture);

        assertTarget(observed, 4, 2);
        assertEquals(4, observed.plan().totalAssignments());
        assertEquals(0, observed.plan().unfilledCount());
        Map<Long, Long> counts = observed.plan().positions().get(0).cells().stream()
                .collect(Collectors.groupingBy(cell -> cell.memberId(), Collectors.counting()));
        assertEquals(Map.of(1L, 2L, 2L, 2L), counts);
        assertEquals(4, observed.plan().positions().get(0).cells().stream()
                .map(cell -> cell.memberId() + ":" + cell.day()).distinct().count());
    }

    @Test
    void targetRemainsSoftBehindPreferenceConflictQuality() {
        Fixture fixture = dailyFixture(MONDAY, 2, 2);
        for (LocalDate day = MONDAY; !day.isAfter(MONDAY.plusDays(1)); day = day.plusDays(1)) {
            fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(0),
                    fullDay(day, SchedulePreferenceType.AVAILABLE)));
            fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(1),
                    fullDay(day, SchedulePreferenceType.PREFER_DAY_OFF)));
        }
        Observation observed = build(fixture);

        assertTarget(observed, 2, 2);
        assertEquals(List.of(1L, 1L), observed.plan().positions().get(0).cells().stream()
                .map(cell -> cell.memberId()).toList());
        assertEquals(0, observed.plan().unfilledCount());
    }

    @Test
    void hardMaxUsesEachCommittedWinnerExactlyOnce() {
        Fixture fixture = dailyFixture(MONDAY, 3, 1);
        fixture.config().setMaxShiftsPerPeriod(2);
        Observation observed = build(fixture);

        assertTarget(observed, 3, 1);
        assertEquals(2, observed.plan().totalAssignments());
        assertEquals(1, observed.plan().unfilledCount());
        assertEquals(List.of(MONDAY.toString(), MONDAY.plusDays(1).toString()),
                observed.plan().positions().get(0).cells().stream().map(cell -> cell.day()).toList());
        assertEquals(MONDAY.plusDays(2).toString(), observed.plan().uncoveredSlots().get(0).date());
        assertTrue(observed.plan().rejectionHints().stream().anyMatch(hint ->
                hint.date().equals(MONDAY.plusDays(2).toString()) && hint.reason().equals("MAX_SHIFTS_LIMIT")));
        assertEquals(List.of(1L), observed.candidateIds());
    }

    @Test
    void splitCreatesTwoPhysicalShiftsWithoutChangingDemandUnits() {
        Fixture fixture = fixture(MONDAY, MONDAY, 2);
        ScheduleBuildWeekdayRegime regime = regime(EnumSet.allOf(DayOfWeek.class),
                option(1, "10:00", "17:00"), option(2, "17:00", "00:00"));
        addRule(regime, DayOfWeek.MONDAY, 1, "10:00", "00:00");
        fixture.attach(List.of(regime));
        Observation observed = build(fixture);

        assertTarget(observed, 1, 2);
        assertEquals(2, observed.plan().totalAssignments());
        assertEquals(0, observed.plan().unfilledCount());
        assertEquals(2, observed.plan().positions().get(0).cells().stream().map(cell -> cell.memberId()).distinct().count());
    }

    @Test
    void buildCarriesAssignedMinutesAcrossDaysBeforeResidualAndTechnicalKeys() {
        Fixture fixture = fixture(MONDAY, MONDAY.plusDays(2), 2);
        ScheduleBuildWeekdayRegime regime = regime(EnumSet.allOf(DayOfWeek.class),
                option(1, "10:00", "16:00"), option(2, "10:00", "20:00"),
                option(3, "17:00", "21:00"));
        addRule(regime, MONDAY.getDayOfWeek(), 1, "10:00", "16:00");
        addRule(regime, MONDAY.plusDays(1).getDayOfWeek(), 1, "10:00", "20:00");
        addRule(regime, MONDAY.plusDays(2).getDayOfWeek(), 1, "17:00", "21:00");
        fixture.attach(List.of(regime));
        fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(1),
                fullDay(MONDAY, SchedulePreferenceType.AVAILABLE)));
        fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(0),
                fullDay(MONDAY, SchedulePreferenceType.PREFER_DAY_OFF)));

        ScheduleAutoBuildPlan plan = build(fixture).plan();
        var assignments = plan.positions().get(0).cells();
        assertEquals(List.of("2:2026-09-14:10:00-16:00", "1:2026-09-15:10:00-20:00",
                        "2:2026-09-16:17:00-21:00"),
                assignments.stream().map(a -> a.memberId() + ":" + a.day() + ":"
                        + a.startTime() + "-" + a.endTime()).toList());
        assertEquals(Map.of(1L, 1L, 2L, 2L), assignments.stream()
                .collect(Collectors.groupingBy(a -> a.memberId(), Collectors.counting())));
        assertEquals(0, plan.unfilledCount());
    }

    @Test
    void heavyDayFactorPrecedesResidualStreakInARealBuild() {
        assertHeavyFridayWinner(List.of(DayOfWeek.FRIDAY.getValue()), 2L);
    }

    @Test
    void emptyHeavyDaySettingLeavesResidualStreakAsTieBreaker() {
        assertHeavyFridayWinner(List.of(), 1L);
    }

    @Test
    void ordinaryDayDoesNotRankStoredHeavyHistory() {
        LocalDate friday = LocalDate.of(2026, 9, 18);
        Fixture fixture = fixture(friday, friday.plusDays(3), 2);
        fixture.config().setHeavyDaysOfWeek(new ArrayList<>(List.of(DayOfWeek.FRIDAY.getValue())));
        ScheduleBuildWeekdayRegime regime = regime(EnumSet.allOf(DayOfWeek.class));
        for (DayOfWeek day : List.of(DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.MONDAY))
            addRule(regime, day, 1, "10:00", "17:00");
        fixture.attach(List.of(regime));
        fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(0),
                fullDay(friday, SchedulePreferenceType.AVAILABLE)));
        fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(1),
                fullDay(friday, SchedulePreferenceType.PREFER_DAY_OFF)));

        var assignments = build(fixture).plan().positions().get(0).cells();
        assertEquals(List.of("1:2026-09-18", "2:2026-09-19", "1:2026-09-21"), assignments.stream()
                .map(a -> a.memberId() + ":" + a.day()).toList());
    }

    @Test
    void overnightEndDateDoesNotChangeHeavyBusinessDate() {
        assertOvernightBusinessDateRanking("21:00", "06:00", 540);
    }

    @Test
    void postMidnightPhysicalStartKeepsHeavyBusinessDate() {
        assertOvernightBusinessDateRanking("00:00", "06:00", 360);
    }

    private static void assertOvernightBusinessDateRanking(String start, String end, long durationMinutes) {
        assertOvernightBusinessDateRanking(start, end, durationMinutes,
                List.of(DayOfWeek.FRIDAY.getValue()), List.of(2L, 1L, 2L));
        assertOvernightBusinessDateRanking(start, end, durationMinutes, List.of(), List.of(2L, 1L, 1L));
    }

    private static void assertOvernightBusinessDateRanking(String start, String end, long durationMinutes,
                                                            List<Integer> heavyDays, List<Long> expectedMembers) {
        LocalDate firstFriday = LocalDate.of(2026, 9, 18);
        LocalDate firstThursday = firstFriday.minusDays(1);
        LocalDate lastFriday = firstFriday.plusDays(7);
        Fixture fixture = fixture(firstThursday, lastFriday, 2);
        fixture.config().setHeavyDaysOfWeek(new ArrayList<>(heavyDays));
        ScheduleBuildShiftOption overnight = option(1, start, end);
        ScheduleBuildWeekdayRegime regime = regime(EnumSet.allOf(DayOfWeek.class), overnight);
        regime.setWorkPeriodStart(time("10:00"));
        regime.setWorkPeriodEnd(time("06:00"));
        addRule(regime, DayOfWeek.FRIDAY, 1, start, end);
        addOverride(regime, firstThursday, 1);
        fixture.attach(List.of(regime));

        RestaurantMember b = fixture.members().get(0); // member 1, earlier technical key
        RestaurantMember a = fixture.members().get(1); // member 2, later technical key
        fixture.submissions().add(submission(fixture.schedule(), a, List.of(
                fullDay(firstThursday, SchedulePreferenceType.AVAILABLE),
                fullDay(firstFriday, SchedulePreferenceType.AVAILABLE),
                fullDay(lastFriday, SchedulePreferenceType.AVAILABLE))));
        fixture.submissions().add(submission(fixture.schedule(), b, List.of(
                fullDay(firstThursday, SchedulePreferenceType.PREFER_DAY_OFF),
                fullDay(firstFriday, SchedulePreferenceType.AVAILABLE),
                fullDay(lastFriday, SchedulePreferenceType.AVAILABLE))));

        Observation observation = build(fixture);
        ScheduleAutoBuildPlan plan = observation.plan();
        var assignments = plan.positions().get(0).cells().stream()
                .sorted(java.util.Comparator.comparing(cell -> cell.day())).toList();
        assertTarget(observation, 3, 2);
        assertEquals(3, plan.totalAssignments());
        assertEquals(0, plan.unfilledCount());
        assertTrue(plan.uncoveredSlots().isEmpty());
        assertEquals(List.of(firstThursday.toString(), firstFriday.toString(), lastFriday.toString()),
                assignments.stream().map(cell -> cell.day()).toList());
        assertEquals(expectedMembers, assignments.stream().map(cell -> cell.memberId()).toList());
        assertEquals(List.of(start, start, start), assignments.stream().map(cell -> cell.startTime()).toList());
        assertEquals(List.of(end, end, end), assignments.stream().map(cell -> cell.endTime()).toList());
        assertEquals(3, assignments.stream()
                .map(cell -> cell.memberId() + ":" + cell.day()).distinct().count());
        assertEquals(Map.of(1L, expectedMembers.stream().filter(id -> id == 1L).count(),
                        2L, expectedMembers.stream().filter(id -> id == 2L).count()),
                assignments.stream().collect(Collectors.groupingBy(cell -> cell.memberId(), Collectors.counting())));
        CanonicalBusinessInterval workPeriod = CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(
                time("10:00"), time("06:00"));
        CanonicalBusinessInterval canonicalOption = CanonicalBusinessIntervalResolver.resolveInside(
                workPeriod, time(start), time(end));
        List<LocalDateTime> expectedPhysicalStarts = start.equals("21:00")
                ? List.of(LocalDateTime.parse("2026-09-17T21:00"), LocalDateTime.parse("2026-09-18T21:00"),
                        LocalDateTime.parse("2026-09-25T21:00"))
                : List.of(LocalDateTime.parse("2026-09-18T00:00"), LocalDateTime.parse("2026-09-19T00:00"),
                        LocalDateTime.parse("2026-09-26T00:00"));
        List<LocalDateTime> expectedPhysicalEnds = List.of(LocalDateTime.parse("2026-09-18T06:00"),
                LocalDateTime.parse("2026-09-19T06:00"), LocalDateTime.parse("2026-09-26T06:00"));
        List<ScheduleAutoBuildPlannerImpl.AssignedInterval> physicalIntervals = assignments.stream()
                .map(cell -> new ScheduleAutoBuildPlannerImpl.AssignedInterval(
                        LocalDate.parse(cell.day()), canonicalOption)).toList();
        assertEquals(expectedPhysicalStarts,
                physicalIntervals.stream().map(ScheduleAutoBuildPlannerImpl.AssignedInterval::physicalStart).toList());
        assertEquals(expectedPhysicalEnds,
                physicalIntervals.stream().map(ScheduleAutoBuildPlannerImpl.AssignedInterval::physicalEnd).toList());
        assertEquals(List.of(durationMinutes, durationMinutes, durationMinutes), physicalIntervals.stream()
                .map(ScheduleAutoBuildPlannerImpl.AssignedInterval::durationMinutes).toList());
    }

    private static void assertHeavyFridayWinner(List<Integer> heavyDays, long finalWinner) {
        LocalDate friday = LocalDate.of(2026, 9, 18);
        Fixture fixture = fixture(friday, friday.plusDays(7), 2);
        fixture.config().setHeavyDaysOfWeek(new ArrayList<>(heavyDays));
        fixture.config().setMaxShiftsPerPeriod(5);
        ScheduleBuildWeekdayRegime regime = regime(EnumSet.allOf(DayOfWeek.class));
        for (DayOfWeek day : List.of(DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY,
                DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY))
            addRule(regime, day, 1, "10:00", "17:00");
        fixture.attach(List.of(regime));
        List<SchedulePreferenceCell> a = new ArrayList<>(), b = new ArrayList<>();
        for (int offset : List.of(0, 1, 2)) {
            a.add(fullDay(friday.plusDays(offset), SchedulePreferenceType.AVAILABLE));
            b.add(fullDay(friday.plusDays(offset), SchedulePreferenceType.PREFER_DAY_OFF));
        }
        for (int offset : List.of(4, 5, 6)) {
            a.add(fullDay(friday.plusDays(offset), SchedulePreferenceType.PREFER_DAY_OFF));
            b.add(fullDay(friday.plusDays(offset), SchedulePreferenceType.AVAILABLE));
        }
        a.add(fullDay(friday.plusDays(7), SchedulePreferenceType.AVAILABLE));
        b.add(fullDay(friday.plusDays(7), SchedulePreferenceType.AVAILABLE));
        fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(0), a));
        fixture.submissions().add(submission(fixture.schedule(), fixture.members().get(1), b));

        ScheduleAutoBuildPlan plan = build(fixture).plan();
        var assignments = plan.positions().get(0).cells();
        assertEquals(List.of(1L, 1L, 1L, 2L, 2L, 2L, finalWinner),
                assignments.stream().map(aCell -> aCell.memberId()).toList());
        assertEquals(7, plan.totalAssignments());
        assertEquals(0, plan.unfilledCount());
        assertEquals(7, assignments.stream().map(aCell -> aCell.memberId() + ":" + aCell.day()).distinct().count());
    }

    private static Fixture singleRegimeFixture(LocalDate start, LocalDate end, int weekly, Integer override,
                                                int memberCount) {
        Fixture fixture = fixture(start, end, memberCount);
        ScheduleBuildWeekdayRegime regime = regime(EnumSet.allOf(DayOfWeek.class));
        addRule(regime, DayOfWeek.MONDAY, weekly, "10:00", "17:00");
        if (override != null) addOverride(regime, MONDAY.plusDays(7), override);
        fixture.attach(List.of(regime));
        return fixture;
    }

    private static Fixture dailyFixture(LocalDate start, int days, int members) {
        Fixture fixture = fixture(start, start.plusDays(days - 1L), members);
        ScheduleBuildWeekdayRegime regime = regime(EnumSet.allOf(DayOfWeek.class));
        for (int i = 0; i < days; i++) addRule(regime, start.plusDays(i).getDayOfWeek(), 1, "10:00", "17:00");
        fixture.attach(List.of(regime));
        return fixture;
    }

    private static Fixture fixture(LocalDate start, LocalDate end, int memberCount) {
        Schedule schedule = Schedule.builder().id(30L).startDate(start).endDate(end)
                .positions(new LinkedHashSet<>(List.of(POSITION))).build();
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder().id(20L)
                .positions(new LinkedHashSet<>(List.of(POSITION))).build();
        ScheduleBuildTemplate template = ScheduleBuildTemplate.builder().id(40L).name("Target regression")
                .positionConfigs(List.of(config)).build();
        config.setTemplate(template);
        List<RestaurantMember> members = new ArrayList<>();
        for (long id = 1; id <= memberCount; id++) members.add(member(id));
        return new Fixture(schedule, config, template, members, new ArrayList<>(), new ArrayList<>());
    }

    private static ScheduleBuildWeekdayRegime regime(EnumSet<DayOfWeek> days,
                                                       ScheduleBuildShiftOption... suppliedOptions) {
        List<ScheduleBuildShiftOption> options = suppliedOptions.length == 0
                ? List.of(option(1, "10:00", "17:00")) : List.of(suppliedOptions);
        ScheduleBuildWeekdayRegime regime = ScheduleBuildWeekdayRegime.builder().daysOfWeek(days)
                .workPeriodStart(time("10:00")).workPeriodEnd(time("00:00")).sortOrder(0)
                .shiftOptions(options).coverageRules(new ArrayList<>()).coverageDateOverrides(new ArrayList<>()).build();
        options.forEach(option -> option.setWeekdayRegime(regime));
        return regime;
    }

    private static void addRule(ScheduleBuildWeekdayRegime regime, DayOfWeek day, int count,
                                String start, String end) {
        ScheduleBuildCoverageRule rule = ScheduleBuildCoverageRule.builder().weekdayRegime(regime)
                .dayOfWeek(day.getValue()).startTime(time(start)).endTime(time(end)).requiredCount(count).build();
        regime.getCoverageRules().add(rule);
    }

    private static void addOverride(ScheduleBuildWeekdayRegime regime, LocalDate date, int count) {
        regime.getCoverageDateOverrides().add(ScheduleBuildCoverageDateOverride.builder().weekdayRegime(regime)
                .date(date).shiftOption(regime.getShiftOptions().get(0)).requiredCount(count).build());
    }

    private static Observation build(Fixture fixture) {
        ScheduleParticipationRepository participations = mock(ScheduleParticipationRepository.class);
        SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
        when(participations.findByScheduleIdOrderById(30L)).thenReturn(fixture.members().stream()
                .map(member -> ScheduleParticipation.builder().schedule(fixture.schedule()).member(member)
                        .positionId(10L).positionName("Cook").build()).toList());
        when(submissions.findWithCellsByScheduleId(30L)).thenReturn(List.copyOf(fixture.submissions()));
        ScheduleAutoBuildPlannerImpl planner = spy(new ScheduleAutoBuildPlannerImpl(submissions, participations));
        AtomicReference<TargetContext> target = new AtomicReference<>();
        AtomicReference<List<Long>> candidateIds = new AtomicReference<>();
        AtomicInteger calls = new AtomicInteger();
        doAnswer(invocation -> {
            TargetContext actual = (TargetContext) invocation.callRealMethod();
            target.set(actual);
            List<RestaurantMember> candidates = invocation.getArgument(2);
            candidateIds.set(candidates.stream().map(RestaurantMember::getId).toList());
            calls.incrementAndGet();
            return actual;
        }).when(planner).targetContext(any(Schedule.class), any(ScheduleBuildPositionConfig.class), anyList());
        ScheduleAutoBuildPlan plan = planner.build(1L, fixture.schedule(), fixture.template());
        assertEquals(1, calls.get());
        return new Observation(plan, target.get(), candidateIds.get());
    }

    private static void assertTarget(Observation observation, long demand, int participants) {
        assertEquals(demand, observation.target().demandUnits());
        assertEquals(participants, observation.target().participantCount());
        assertTrue(observation.target().present());
    }

    private static RestaurantMember member(long id) {
        return RestaurantMember.builder().id(id).position(POSITION)
                .user(User.builder().id(id).firstName("Member " + id).lastName("Tester")
                        .fullName("Member " + id + " Tester").build()).build();
    }

    private static ScheduleBuildShiftOption option(long id, String start, String end) {
        return ScheduleBuildShiftOption.builder().id(id).label("Shift " + id).startTime(time(start))
                .endTime(time(end)).sortOrder((int) id).build();
    }

    private static SchedulePreferenceCell fullDay(LocalDate day, SchedulePreferenceType type) {
        return SchedulePreferenceCell.builder().day(day).type(type).fullDay(true).build();
    }

    private static SchedulePreferenceSubmission submission(Schedule schedule, RestaurantMember member,
                                                             SchedulePreferenceCell cell) {
        return submission(schedule, member, List.of(cell));
    }

    private static SchedulePreferenceSubmission submission(Schedule schedule, RestaurantMember member,
                                                             List<SchedulePreferenceCell> cells) {
        SchedulePreferenceSubmission submission = SchedulePreferenceSubmission.builder().schedule(schedule)
                .member(member).cells(cells).build();
        cells.forEach(cell -> cell.setSubmission(submission));
        return submission;
    }

    private static LocalTime time(String value) { return LocalTime.parse(value); }

    private record Observation(ScheduleAutoBuildPlan plan, TargetContext target, List<Long> candidateIds) { }

    private record Fixture(Schedule schedule, ScheduleBuildPositionConfig config, ScheduleBuildTemplate template,
                           List<RestaurantMember> members, List<SchedulePreferenceSubmission> submissions,
                           List<ScheduleBuildWeekdayRegime> regimes) {
        void attach(List<ScheduleBuildWeekdayRegime> attached) {
            config.setWeekdayRegimes(attached);
            attached.forEach(regime -> regime.setPositionConfig(config));
            regimes.clear();
            regimes.addAll(attached);
        }
    }
}
