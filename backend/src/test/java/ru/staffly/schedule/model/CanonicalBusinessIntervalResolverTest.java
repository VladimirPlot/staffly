package ru.staffly.schedule.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CanonicalBusinessIntervalResolverTest {

    @Test
    void canonicalizesSameDayOvernightAndTwentyFourHourWorkPeriods() {
        assertInterval(workPeriod("10:00", "18:00"), "10:00", 0, "18:00", 0);
        assertInterval(workPeriod("10:00", "06:00"), "10:00", 0, "06:00", 1);
        assertInterval(workPeriod("00:00", "00:00"), "00:00", 0, "00:00", 1);
        assertInterval(workPeriod("10:00", "10:00"), "10:00", 0, "10:00", 1);
    }

    @Test
    void resolvesRequiredPlacementCases() {
        assertResolved("10:00", "06:00", "10:00", "18:00", 0, 0); // A
        assertResolved("10:00", "06:00", "18:00", "06:00", 0, 1); // B
        assertResolved("10:00", "06:00", "00:00", "06:00", 1, 1); // C
        assertResolved("00:00", "00:00", "00:00", "12:00", 0, 0); // D
        assertResolved("00:00", "00:00", "12:00", "00:00", 0, 1); // E
        assertResolved("00:00", "06:00", "00:00", "03:00", 0, 0); // F
        assertResolved("18:00", "06:00", "21:00", "02:00", 0, 1); // G
    }

    @Test
    void rejectsIntervalsOutsideWorkPeriod() {
        assertOutside("10:00", "18:00", "17:00", "20:00"); // H
        assertOutside("10:00", "18:00", "08:00", "12:00"); // I
    }

    @Test
    void resolvesMidnightBoundaryOnEitherBusinessDate() {
        assertResolved("00:00", "06:00", "00:00", "00:01", 0, 0);
        assertResolved("10:00", "00:00", "23:59", "00:00", 0, 1);
        assertResolved("10:00", "10:00", "00:00", "00:01", 1, 1);
    }

    @Test
    void rejectsEqualRawIntervalRatherThanGivingItWorkPeriodSemantics() {
        CanonicalBusinessInterval workPeriod = workPeriod("00:00", "00:00");

        assertThrows(IllegalArgumentException.class,
                () -> CanonicalBusinessIntervalResolver.resolveInside(workPeriod, time("12:00"), time("12:00")));
    }

    @Test
    void rejectsAmbiguousPlacementForAnOutOfContractWorkPeriodLongerThanTwentyFourHours() {
        CanonicalBusinessInterval longerThanOneDay = new CanonicalBusinessInterval(
                time("00:00"), 0, time("23:59"), 1
        );

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> CanonicalBusinessIntervalResolver.resolveInside(
                        longerThanOneDay,
                        time("01:00"),
                        time("02:00")
                ));
        assertEquals("interval placement inside work period is ambiguous", error.getMessage());
    }

    @Test
    void projectsCanonicalOffsetsToPhysicalDateTimes() {
        CanonicalBusinessInterval interval = CanonicalBusinessIntervalResolver.resolveInside(
                workPeriod("10:00", "06:00"),
                time("00:00"),
                time("06:00")
        );
        LocalDate friday = LocalDate.of(2026, 9, 11);

        assertEquals(LocalDateTime.of(2026, 9, 12, 0, 0), interval.physicalStart(friday));
        assertEquals(LocalDateTime.of(2026, 9, 12, 6, 0), interval.physicalEnd(friday));
    }

    @Test
    void failsFastOnNullInputs() {
        assertThrows(NullPointerException.class,
                () -> CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(null, time("06:00")));
        assertThrows(NullPointerException.class,
                () -> CanonicalBusinessIntervalResolver.resolveInside(null, time("00:00"), time("06:00")));
        assertThrows(NullPointerException.class,
                () -> workPeriod("10:00", "06:00").physicalStart(null));
    }

    private static CanonicalBusinessInterval workPeriod(String start, String end) {
        return CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(time(start), time(end));
    }

    private static void assertResolved(
            String workStart,
            String workEnd,
            String intervalStart,
            String intervalEnd,
            int expectedStartOffset,
            int expectedEndOffset
    ) {
        CanonicalBusinessInterval actual = CanonicalBusinessIntervalResolver.resolveInside(
                workPeriod(workStart, workEnd),
                time(intervalStart),
                time(intervalEnd)
        );
        assertInterval(actual, intervalStart, expectedStartOffset, intervalEnd, expectedEndOffset);
    }

    private static void assertOutside(String workStart, String workEnd, String intervalStart, String intervalEnd) {
        CanonicalBusinessInterval workPeriod = workPeriod(workStart, workEnd);
        assertThrows(IllegalArgumentException.class, () -> CanonicalBusinessIntervalResolver.resolveInside(
                workPeriod,
                time(intervalStart),
                time(intervalEnd)
        ));
    }

    private static void assertInterval(
            CanonicalBusinessInterval actual,
            String expectedStart,
            int expectedStartOffset,
            String expectedEnd,
            int expectedEndOffset
    ) {
        assertEquals(time(expectedStart), actual.startTime());
        assertEquals(expectedStartOffset, actual.startDayOffset());
        assertEquals(time(expectedEnd), actual.endTime());
        assertEquals(expectedEndOffset, actual.endDayOffset());
    }

    private static LocalTime time(String value) {
        return LocalTime.parse(value);
    }
}
