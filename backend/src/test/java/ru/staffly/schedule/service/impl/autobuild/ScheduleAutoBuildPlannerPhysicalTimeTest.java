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
