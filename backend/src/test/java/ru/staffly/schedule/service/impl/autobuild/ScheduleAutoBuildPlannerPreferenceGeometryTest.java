package ru.staffly.schedule.service.impl.autobuild;

import org.junit.jupiter.api.Test;
import ru.staffly.schedule.model.CanonicalBusinessInterval;
import ru.staffly.schedule.model.CanonicalBusinessIntervalResolver;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;

import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class ScheduleAutoBuildPlannerPreferenceGeometryTest {
    private final ScheduleAutoBuildPlannerImpl planner = new ScheduleAutoBuildPlannerImpl(
            mock(SchedulePreferenceSubmissionRepository.class),
            mock(ScheduleParticipationRepository.class)
    );

    @Test
    void characterizesCanonicalPositiveGeometry() {
        assertStatus("EXACT_INTERVAL_PREFERENCE", "10:00", "06:00", "00:00", "06:00", available("00:00", "06:00")); // A
        assertStatus("EXACT_INTERVAL_PREFERENCE", "10:00", "06:00", "18:00", "06:00", available("18:00", "06:00")); // B
        assertStatus("PARTIAL_INTERVAL_FALLBACK", "10:00", "06:00", "18:00", "06:00", available("00:00", "06:00")); // C
        assertStatus("COVERING_INTERVAL_PREFERENCE", "10:00", "06:00", "00:00", "06:00", available("18:00", "06:00")); // D
        assertStatus("PARTIAL_INTERVAL_FALLBACK", "10:00", "06:00", "21:00", "02:00", available("00:00", "06:00")); // E
        assertStatus("DISJOINT_AVAILABLE_FALLBACK", "10:00", "06:00", "18:00", "02:00", available("03:00", "06:00")); // F
        assertStatus("DISJOINT_AVAILABLE_FALLBACK", "10:00", "06:00", "00:00", "06:00", available("18:00", "23:00")); // G
        assertStatus("PARTIAL_INTERVAL_FALLBACK", "10:00", "18:00", "10:00", "18:00", available("14:00", "18:00")); // H
        assertStatus("COVERING_INTERVAL_PREFERENCE", "10:00", "18:00", "12:00", "16:00", available("10:00", "18:00")); // I
    }

    @Test
    void keepsFullDayAndMissingCellSemanticsIndependentOfIntervalResolution() {
        assertStatus("FULL_DAY_POSITIVE", "10:00", "06:00", "00:00", "06:00", fullDay(SchedulePreferenceType.AVAILABLE)); // J
        assertStatus("NO_PREFERENCE", "10:00", "06:00", "00:00", "06:00", null); // K
        assertStatus("HARD_NEGATIVE_FALLBACK", "10:00", "06:00", "00:00", "06:00", fullDay(SchedulePreferenceType.UNAVAILABLE)); // L
        assertStatus("SOFT_NEGATIVE_FALLBACK", "10:00", "06:00", "00:00", "06:00", fullDay(SchedulePreferenceType.PREFER_DAY_OFF)); // M
    }

    @Test
    void characterizesCanonicalNegativeGeometry() {
        assertStatus("HARD_NEGATIVE_FALLBACK", "10:00", "06:00", "00:00", "06:00", interval(SchedulePreferenceType.UNAVAILABLE, "18:00", "02:00")); // N1
        assertStatus("NO_PREFERENCE", "10:00", "06:00", "03:00", "06:00", interval(SchedulePreferenceType.UNAVAILABLE, "18:00", "02:00")); // N2
        assertStatus("SOFT_NEGATIVE_FALLBACK", "10:00", "06:00", "00:00", "06:00", interval(SchedulePreferenceType.PREFER_DAY_OFF, "18:00", "02:00"));
        assertStatus("NO_PREFERENCE", "10:00", "06:00", "03:00", "06:00", interval(SchedulePreferenceType.PREFER_DAY_OFF, "18:00", "02:00"));
    }

    @Test
    void invalidOrMalformedPersistedIntervalContributesNoPreference() {
        assertStatus("NO_PREFERENCE", "10:00", "18:00", "10:00", "18:00", available("18:00", "20:00"));
        assertStatus("NO_PREFERENCE", "10:00", "18:00", "10:00", "18:00",
                SchedulePreferenceCell.builder().type(SchedulePreferenceType.AVAILABLE).fullDay(false).startTime(time("12:00")).build());
        assertStatus("NO_PREFERENCE", "10:00", "18:00", "10:00", "18:00", available("12:00", "12:00"));
    }

    @Test
    void projectsDaytimeConflictMinutes() {
        assertEvaluation("NO_PREFERENCE", 0, 0, "10:00", "00:00", "17:00", "00:00", null);
        assertEvaluation("FULL_DAY_POSITIVE", 0, 0, "10:00", "00:00", "17:00", "00:00",
                fullDay(SchedulePreferenceType.AVAILABLE));
        assertEvaluation("EXACT_INTERVAL_PREFERENCE", 0, 0, "10:00", "00:00", "17:00", "00:00", available("17:00", "00:00"));
        assertEvaluation("COVERING_INTERVAL_PREFERENCE", 0, 0, "10:00", "00:00", "17:00", "00:00", available("14:00", "00:00"));
        assertEvaluation("COVERING_INTERVAL_PREFERENCE", 0, 0, "10:00", "00:00", "17:00", "00:00", available("10:00", "00:00"));
        assertEvaluation("PARTIAL_INTERVAL_FALLBACK", 120, 0, "10:00", "00:00", "17:00", "00:00", available("17:00", "22:00"));
        assertEvaluation("DISJOINT_AVAILABLE_FALLBACK", 420, 0, "10:00", "00:00", "17:00", "00:00", available("10:00", "17:00"));
        assertEvaluation("SOFT_NEGATIVE_FALLBACK", 0, 420, "10:00", "00:00", "17:00", "00:00", fullDay(SchedulePreferenceType.PREFER_DAY_OFF));
        assertEvaluation("HARD_NEGATIVE_FALLBACK", 420, 0, "10:00", "00:00", "17:00", "00:00", fullDay(SchedulePreferenceType.UNAVAILABLE));
    }

    @Test
    void projectsOvernightConflictMinutes() {
        assertEvaluation("EXACT_INTERVAL_PREFERENCE", 0, 0, "10:00", "06:00", "21:00", "02:00", available("21:00", "02:00"));
        assertEvaluation("COVERING_INTERVAL_PREFERENCE", 0, 0, "10:00", "06:00", "21:00", "02:00", available("18:00", "04:00"));
        assertEvaluation("PARTIAL_INTERVAL_FALLBACK", 120, 0, "10:00", "06:00", "21:00", "02:00", available("21:00", "00:00"));
        assertEvaluation("PARTIAL_INTERVAL_FALLBACK", 180, 0, "10:00", "06:00", "21:00", "02:00", available("00:00", "03:00"));
        assertEvaluation("DISJOINT_AVAILABLE_FALLBACK", 300, 0, "10:00", "06:00", "21:00", "02:00", available("03:00", "06:00"));
    }

    @Test
    void comparesPreferenceLexicographicallyWithoutStatusRanks() {
        var none = evaluation("10:00", "00:00", "17:00", "00:00", null);
        var exact = evaluation("10:00", "00:00", "17:00", "00:00", available("17:00", "00:00"));
        var covering = evaluation("10:00", "00:00", "17:00", "00:00", available("14:00", "00:00"));
        var fullDay = evaluation("10:00", "00:00", "17:00", "00:00", fullDay(SchedulePreferenceType.AVAILABLE));
        var soft = evaluation("10:00", "00:00", "17:00", "00:00", fullDay(SchedulePreferenceType.PREFER_DAY_OFF));
        var oneMinuteHard = evaluation("10:00", "00:00", "17:00", "00:00", available("17:01", "00:00"));
        var partial = evaluation("10:00", "00:00", "17:00", "00:00", available("17:00", "22:00"));
        var disjoint = evaluation("10:00", "00:00", "17:00", "00:00", available("10:00", "17:00"));
        var unavailable = evaluation("10:00", "00:00", "17:00", "00:00", fullDay(SchedulePreferenceType.UNAVAILABLE));

        assertEquals(0, planner.comparePreference(none, exact));
        assertEquals(0, planner.comparePreference(covering, exact));
        assertEquals(0, planner.comparePreference(fullDay, covering));
        assertEquals(-1, planner.comparePreference(soft, oneMinuteHard));
        assertEquals(-1, planner.comparePreference(partial, disjoint));
        assertEquals(0, planner.comparePreference(disjoint, unavailable));
    }

    private void assertEvaluation(String status, long hard, long soft, String workStart, String workEnd,
                                  String shiftStart, String shiftEnd, SchedulePreferenceCell preference) {
        var evaluation = evaluation(workStart, workEnd, shiftStart, shiftEnd, preference);
        assertEquals(status, evaluation.status().name());
        assertEquals(hard, evaluation.hardConflictMinutes());
        assertEquals(soft, evaluation.softConflictMinutes());
    }

    private ScheduleAutoBuildPlannerImpl.PreferenceEvaluation evaluation(
            String workStart, String workEnd, String shiftStart, String shiftEnd, SchedulePreferenceCell preference) {
        CanonicalBusinessInterval workPeriod = CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(
                time(workStart), time(workEnd));
        CanonicalBusinessInterval shift = CanonicalBusinessIntervalResolver.resolveInside(
                workPeriod, time(shiftStart), time(shiftEnd));
        return planner.preferenceEvaluationFor(preference, workPeriod, shift);
    }

    private void assertStatus(
            String expected,
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd,
            SchedulePreferenceCell preference
    ) {
        CanonicalBusinessInterval workPeriod = CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(
                time(workStart), time(workEnd));
        CanonicalBusinessInterval shift = CanonicalBusinessIntervalResolver.resolveInside(
                workPeriod, time(shiftStart), time(shiftEnd));

        assertEquals(expected, planner.matchStatusFor(preference, workPeriod, shift).name());
    }

    private static SchedulePreferenceCell available(String start, String end) {
        return interval(SchedulePreferenceType.AVAILABLE, start, end);
    }

    private static SchedulePreferenceCell interval(SchedulePreferenceType type, String start, String end) {
        return SchedulePreferenceCell.builder()
                .type(type)
                .fullDay(false)
                .startTime(time(start))
                .endTime(time(end))
                .build();
    }

    private static SchedulePreferenceCell fullDay(SchedulePreferenceType type) {
        return SchedulePreferenceCell.builder().type(type).fullDay(true).build();
    }

    private static LocalTime time(String value) {
        return LocalTime.parse(value);
    }
}
