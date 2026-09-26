package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.schedule.model.CanonicalBusinessInterval;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScheduleAutoBuildPlannerWorkStreakTest {
    private static final CanonicalBusinessInterval DAY =
            new CanonicalBusinessInterval(LocalTime.of(10, 0), 0, LocalTime.of(17, 0), 0);
    private static final CanonicalBusinessInterval OVERNIGHT =
            new CanonicalBusinessInterval(LocalTime.of(21, 0), 0, LocalTime.of(6, 0), 1);

    @Test
    void resultingWorkStreakCountsBackwardBusinessDatesAndIncludesCandidateExactlyOnce() {
        LocalDate friday = LocalDate.of(2026, 9, 18);
        assertEquals(1, streak(friday));
        assertEquals(2, streak(friday, friday.minusDays(1)));
        assertEquals(3, streak(friday, friday.minusDays(1), friday.minusDays(2)));
        assertEquals(4, streak(friday, friday.minusDays(1), friday.minusDays(2), friday.minusDays(3)));
        assertEquals(2, streak(friday, friday.minusDays(1), friday.minusDays(3)));
        assertEquals(1, streak(friday, friday.minusDays(2), friday.minusDays(3), friday.minusDays(4)));
        assertEquals(2, streak(LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 20)));
        assertEquals(3, streak(LocalDate.of(2026, 10, 2),
                LocalDate.of(2026, 9, 30), LocalDate.of(2026, 10, 1)));
    }

    @Test
    void projectionIsOrderIndependentNonMutatingAndUsesLogicalDateForOvernightWork() {
        LocalDate day = LocalDate.of(2026, 9, 16);
        List<ScheduleAutoBuildPlannerImpl.AssignedInterval> history = new ArrayList<>(List.of(
                new ScheduleAutoBuildPlannerImpl.AssignedInterval(day.minusDays(2), DAY),
                new ScheduleAutoBuildPlannerImpl.AssignedInterval(day.minusDays(1), OVERNIGHT)));
        List<ScheduleAutoBuildPlannerImpl.AssignedInterval> snapshot = List.copyOf(history);
        assertEquals(3, ScheduleAutoBuildPlannerImpl.resultingWorkStreak(day, history));
        Collections.reverse(history);
        assertEquals(3, ScheduleAutoBuildPlannerImpl.resultingWorkStreak(day, history));
        assertEquals(List.of(snapshot.get(1), snapshot.get(0)), history);
    }

    @Test
    void oneOffProjectionUsesOnlyImmediateBusinessDatesAndDoesNotMutateHistory() {
        LocalDate wednesday = LocalDate.of(2026, 9, 16);
        LocalDate sunday = wednesday.minusDays(3);
        LocalDate monday = wednesday.minusDays(2);
        LocalDate tuesday = wednesday.minusDays(1);

        assertFalse(oneOff(wednesday));
        assertTrue(oneOff(wednesday, monday));
        assertFalse(oneOff(wednesday, tuesday));
        assertFalse(oneOff(wednesday, monday, tuesday));
        assertFalse(oneOff(wednesday, sunday));
        assertTrue(oneOff(wednesday, sunday, monday));

        List<ScheduleAutoBuildPlannerImpl.AssignedInterval> history = new ArrayList<>(List.of(
                new ScheduleAutoBuildPlannerImpl.AssignedInterval(monday, DAY),
                new ScheduleAutoBuildPlannerImpl.AssignedInterval(sunday, DAY)));
        List<ScheduleAutoBuildPlannerImpl.AssignedInterval> snapshot = List.copyOf(history);
        assertTrue(ScheduleAutoBuildPlannerImpl.createsOneOffPattern(wednesday, history));
        Collections.reverse(history);
        assertTrue(ScheduleAutoBuildPlannerImpl.createsOneOffPattern(wednesday, history));
        assertEquals(List.of(snapshot.get(1), snapshot.get(0)), history);
    }

    @Test
    void oneOffPatternCanOnlyOccurWithSingleDayResultingStreak() {
        LocalDate wednesday = LocalDate.of(2026, 9, 16);
        LocalDate sunday = wednesday.minusDays(3);
        LocalDate monday = wednesday.minusDays(2);
        LocalDate tuesday = wednesday.minusDays(1);

        assertProjection(wednesday, List.of(monday), true, 1);
        assertProjection(wednesday, List.of(sunday, monday), true, 1);
        assertProjection(wednesday, List.of(tuesday), false, 2);
        assertProjection(wednesday, List.of(monday, tuesday), false, 3);
    }

    @Test
    void oneOffProjectionCrossesMonthBoundaryAndUsesLogicalOvernightBusinessDate() {
        LocalDate octoberSecond = LocalDate.of(2026, 10, 2);
        assertTrue(oneOff(octoberSecond, LocalDate.of(2026, 9, 30)));

        LocalDate wednesday = LocalDate.of(2026, 9, 16);
        LocalDate monday = wednesday.minusDays(2);
        LocalDate tuesday = wednesday.minusDays(1);
        var mondayOvernight = new ScheduleAutoBuildPlannerImpl.AssignedInterval(monday, OVERNIGHT);
        var mondayPostMidnight = new ScheduleAutoBuildPlannerImpl.AssignedInterval(monday,
                new CanonicalBusinessInterval(LocalTime.MIDNIGHT, 1, LocalTime.of(6, 0), 1));
        assertTrue(ScheduleAutoBuildPlannerImpl.createsOneOffPattern(wednesday, List.of(mondayOvernight)));
        assertTrue(ScheduleAutoBuildPlannerImpl.createsOneOffPattern(wednesday, List.of(mondayPostMidnight)));
        assertFalse(ScheduleAutoBuildPlannerImpl.createsOneOffPattern(wednesday,
                List.of(new ScheduleAutoBuildPlannerImpl.AssignedInterval(tuesday, OVERNIGHT))));
    }

    private static int streak(LocalDate proposed, LocalDate... worked) {
        return ScheduleAutoBuildPlannerImpl.resultingWorkStreak(proposed,
                java.util.Arrays.stream(worked)
                        .map(day -> new ScheduleAutoBuildPlannerImpl.AssignedInterval(day, DAY)).toList());
    }

    private static boolean oneOff(LocalDate proposed, LocalDate... worked) {
        return ScheduleAutoBuildPlannerImpl.createsOneOffPattern(proposed,
                java.util.Arrays.stream(worked)
                        .map(day -> new ScheduleAutoBuildPlannerImpl.AssignedInterval(day, DAY)).toList());
    }

    private static void assertProjection(
            LocalDate proposed,
            List<LocalDate> worked,
            boolean expectedOneOff,
            int expectedStreak
    ) {
        List<ScheduleAutoBuildPlannerImpl.AssignedInterval> history = worked.stream()
                .map(day -> new ScheduleAutoBuildPlannerImpl.AssignedInterval(day, DAY)).toList();
        assertEquals(expectedOneOff, ScheduleAutoBuildPlannerImpl.createsOneOffPattern(proposed, history));
        assertEquals(expectedStreak, ScheduleAutoBuildPlannerImpl.resultingWorkStreak(proposed, history));
    }
}
