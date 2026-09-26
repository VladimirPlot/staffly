package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.schedule.model.CanonicalBusinessInterval;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

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

    private static int streak(LocalDate proposed, LocalDate... worked) {
        return ScheduleAutoBuildPlannerImpl.resultingWorkStreak(proposed,
                java.util.Arrays.stream(worked)
                        .map(day -> new ScheduleAutoBuildPlannerImpl.AssignedInterval(day, DAY)).toList());
    }
}
