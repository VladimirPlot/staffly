package ru.staffly.checklist.service;

import org.junit.jupiter.api.Test;
import ru.staffly.checklist.model.*;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

class ChecklistResetCalculatorTest {
    private Checklist checklist(ChecklistPeriodicity periodicity) {
        return Checklist.builder().kind(ChecklistKind.TRACKABLE).periodicity(periodicity).resetTime(LocalTime.of(2, 30))
                .resetDayOfWeek(7).resetDayOfMonth(31).build();
    }
    @Test void dailyTimeDoesNotDriftAfterTheSpringDstGap() {
        var c = checklist(ChecklistPeriodicity.DAILY); var zone = ZoneId.of("Europe/Berlin");
        assertEquals(Instant.parse("2026-03-30T00:30:00Z"), ChecklistResetCalculator.computeNextReset(Instant.parse("2026-03-29T04:00:00Z"), c, zone));
        assertEquals(Instant.parse("2026-03-28T01:30:00Z"), ChecklistResetCalculator.computeLatestDueReset(
                Instant.parse("2026-03-27T00:00:00Z"), c, zone, Instant.parse("2026-03-29T01:00:00Z")));
    }
    @Test void weeklyScheduleKeepsItsWallClockTimeAcrossDst() {
        var c = checklist(ChecklistPeriodicity.WEEKLY); var zone = ZoneId.of("Europe/Berlin");
        assertEquals(Instant.parse("2026-03-29T01:30:00Z"), ChecklistResetCalculator.computeNextReset(Instant.parse("2026-03-23T00:00:00Z"), c, zone));
        assertEquals(Instant.parse("2026-04-05T00:30:00Z"), ChecklistResetCalculator.computeNextReset(Instant.parse("2026-03-29T01:30:00Z"), c, zone));
    }
    @Test void monthly31stClampsFebruaryAndReturnsToMarch31st() {
        var c = checklist(ChecklistPeriodicity.MONTHLY); var zone = ZoneId.of("UTC");
        assertEquals(Instant.parse("2026-02-28T02:30:00Z"), ChecklistResetCalculator.computeNextReset(Instant.parse("2026-01-31T02:30:00Z"), c, zone));
        assertEquals(Instant.parse("2026-03-31T02:30:00Z"), ChecklistResetCalculator.computeNextReset(Instant.parse("2026-02-28T02:30:00Z"), c, zone));
    }
    @Test void exactBoundaryIsDueAndAnAlreadyAppliedBoundaryIsNotRepeated() {
        var c = checklist(ChecklistPeriodicity.DAILY); var zone = ZoneId.of("UTC");
        var boundary = Instant.parse("2026-10-10T02:30:00Z");
        assertEquals(boundary, ChecklistResetCalculator.computeLatestDueReset(boundary.minusSeconds(1), c, zone, boundary));
        assertNull(ChecklistResetCalculator.computeLatestDueReset(boundary, c, zone, boundary));
    }
    @Test void autumnOverlapProducesOnlyOneResetForTheLocalDay() {
        var c = checklist(ChecklistPeriodicity.DAILY); var zone = ZoneId.of("Europe/Berlin");
        var first = Instant.parse("2026-10-25T00:30:00Z");
        assertEquals(first, ChecklistResetCalculator.computeNextReset(first.minusSeconds(1), c, zone));
        assertEquals(Instant.parse("2026-10-26T01:30:00Z"), ChecklistResetCalculator.computeNextReset(first, c, zone));
    }
}
