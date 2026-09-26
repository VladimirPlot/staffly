package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.schedule.model.CanonicalBusinessInterval;
import ru.staffly.schedule.model.CanonicalBusinessIntervalResolver;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScheduleAutoBuildPlannerPhysicalTimeTest {
    private static final LocalDate FRIDAY = LocalDate.of(2026, 9, 11);

    @Test
    void placesShiftOptionsOnTheirCanonicalPhysicalDates() {
        assertPlacement("10:00", "06:00", "10:00", "18:00", "2026-09-11T10:00", "2026-09-11T18:00");
        assertPlacement("10:00", "06:00", "18:00", "06:00", "2026-09-11T18:00", "2026-09-12T06:00");
        assertPlacement("10:00", "06:00", "00:00", "06:00", "2026-09-12T00:00", "2026-09-12T06:00");
        assertPlacement("10:00", "10:00", "00:00", "06:00", "2026-09-12T00:00", "2026-09-12T06:00");
        assertPlacement("00:00", "00:00", "18:00", "00:00", "2026-09-11T18:00", "2026-09-12T00:00");
    }

    @Test
    void calculatesAssignedMinutesFromCanonicalPhysicalInterval() {
        assertEquals(420, assigned(FRIDAY, resolve(workPeriod("10:00", "10:00"), "10:00", "17:00")).durationMinutes());
        assertEquals(300, assigned(FRIDAY, resolve(workPeriod("10:00", "10:00"), "21:00", "02:00")).durationMinutes());
        assertEquals(360, assigned(FRIDAY, resolve(workPeriod("00:00", "00:00"), "00:00", "06:00")).durationMinutes());
        assertEquals(361, assigned(FRIDAY, resolve(workPeriod("10:00", "10:00"), "10:00", "16:01")).durationMinutes());
        assertEquals(1440, assigned(FRIDAY, resolve(workPeriod("10:00", "10:00"), "10:00", "10:00")).durationMinutes());
    }

    @Test
    void preservesResolverRejectionForOvernightShiftInsideMidnightFullDay() {
        CanonicalBusinessInterval workPeriod = workPeriod("00:00", "00:00");

        assertThrows(IllegalArgumentException.class, () -> resolve(workPeriod, "18:00", "06:00"));
    }

    @Test
    void calculatesCanonicalRestMatrix() {
        assertRest("10:00", "06:00", "00:00", "06:00", "18:00", "00:00", 12, true); // R1
        assertRest("10:00", "06:00", "18:00", "06:00", "10:00", "18:00", 4, false); // R2
        assertRest("10:00", "06:00", "00:00", "06:00", "10:00", "18:00", 4, false); // R3
        assertRest("10:00", "10:00", "00:00", "06:00", "10:00", "18:00", 4, false); // R4
    }

    @Test
    void calculatesMinutePreciseWorstRestDeficitOnEitherSide() {
        var candidate = physical("2026-09-15T10:00", "2026-09-15T18:00");
        assertEquals(0, deficit(candidate));
        assertEquals(0, deficit(candidate, physical("2026-09-14T14:00", "2026-09-14T22:00")));
        assertEquals(1, deficit(candidate, physical("2026-09-14T20:00", "2026-09-14T22:01")));
        assertEquals(60, deficit(candidate, physical("2026-09-14T20:00", "2026-09-14T23:00")));
        assertEquals(180, deficit(candidate, physical("2026-09-14T20:00", "2026-09-15T01:00")));
        assertEquals(480, deficit(candidate, physical("2026-09-15T00:00", "2026-09-15T06:00")));
        var future = physical("2026-09-16T05:00", "2026-09-16T13:00");
        assertEquals(60, deficit(candidate, future));

        var previous = physical("2026-09-14T16:00", "2026-09-15T00:00");
        var closeFuture = physical("2026-09-16T02:00", "2026-09-16T10:00");
        assertEquals(240, deficit(candidate, previous, closeFuture));
        assertEquals(240, deficit(candidate, closeFuture, previous));
        assertEquals(0, ScheduleAutoBuildPlannerImpl.minRestDeficitMinutes(List.of(previous), candidate, null));
        assertEquals(0, ScheduleAutoBuildPlannerImpl.minRestDeficitMinutes(List.of(previous), candidate, 0));
    }

    @Test
    void detectsPhysicalCollisionAcrossDifferentBusinessDays() {
        CanonicalBusinessInterval fridayWorkPeriod = workPeriod("10:00", "06:00");
        ScheduleAutoBuildPlannerImpl.AssignedInterval friday = assigned(
                FRIDAY, resolve(fridayWorkPeriod, "00:00", "06:00"));
        ScheduleAutoBuildPlannerImpl.AssignedInterval saturday = assigned(
                FRIDAY.plusDays(1), resolve(workPeriod("04:00", "12:00"), "04:00", "12:00"));

        assertEquals(FRIDAY, friday.day());
        assertEquals(FRIDAY.plusDays(1), saturday.day());
        assertTrue(friday.overlaps(saturday));
    }

    private static void assertRest(
            String workStart,
            String workEnd,
            String fridayStart,
            String fridayEnd,
            String saturdayStart,
            String saturdayEnd,
            long expectedRestHours,
            boolean expectedEnoughRest
    ) {
        CanonicalBusinessInterval workPeriod = workPeriod(workStart, workEnd);
        ScheduleAutoBuildPlannerImpl.AssignedInterval friday = assigned(
                FRIDAY, resolve(workPeriod, fridayStart, fridayEnd));
        ScheduleAutoBuildPlannerImpl.AssignedInterval saturday = assigned(
                FRIDAY.plusDays(1), resolve(workPeriod, saturdayStart, saturdayEnd));

        assertEquals(expectedRestHours, Duration.between(friday.physicalEnd(), saturday.physicalStart()).toHours());
        assertEquals(expectedEnoughRest,
                ScheduleAutoBuildPlannerImpl.hasEnoughRest(List.of(friday), saturday, 12));
    }

    private static void assertPlacement(
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd,
            String expectedStart,
            String expectedEnd
    ) {
        ScheduleAutoBuildPlannerImpl.AssignedInterval interval = assigned(
                FRIDAY, resolve(workPeriod(workStart, workEnd), shiftStart, shiftEnd));

        assertEquals(FRIDAY, interval.day());
        assertEquals(LocalDateTime.parse(expectedStart), interval.physicalStart());
        assertEquals(LocalDateTime.parse(expectedEnd), interval.physicalEnd());
    }

    private static ScheduleAutoBuildPlannerImpl.AssignedInterval assigned(
            LocalDate day,
            CanonicalBusinessInterval interval
    ) {
        return new ScheduleAutoBuildPlannerImpl.AssignedInterval(day, interval);
    }

    private static long deficit(ScheduleAutoBuildPlannerImpl.AssignedInterval candidate,
                                ScheduleAutoBuildPlannerImpl.AssignedInterval... existing) {
        return ScheduleAutoBuildPlannerImpl.minRestDeficitMinutes(List.of(existing), candidate, 12);
    }

    private static ScheduleAutoBuildPlannerImpl.AssignedInterval physical(String start, String end) {
        LocalDateTime physicalStart = LocalDateTime.parse(start);
        LocalDateTime physicalEnd = LocalDateTime.parse(end);
        int endDayOffset = physicalEnd.toLocalDate().equals(physicalStart.toLocalDate()) ? 0 : 1;
        return new ScheduleAutoBuildPlannerImpl.AssignedInterval(physicalStart.toLocalDate(),
                new CanonicalBusinessInterval(physicalStart.toLocalTime(), 0,
                        physicalEnd.toLocalTime(), endDayOffset));
    }

    private static CanonicalBusinessInterval workPeriod(String start, String end) {
        return CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(time(start), time(end));
    }

    private static CanonicalBusinessInterval resolve(
            CanonicalBusinessInterval workPeriod,
            String start,
            String end
    ) {
        return CanonicalBusinessIntervalResolver.resolveInside(workPeriod, time(start), time(end));
    }

    private static LocalTime time(String value) {
        return LocalTime.parse(value);
    }
}
