package ru.staffly.schedule.model;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Places raw local-time intervals in the time space of a single business date.
 */
public final class CanonicalBusinessIntervalResolver {

    private CanonicalBusinessIntervalResolver() {
    }

    /**
     * Canonicalizes a work period. Equal boundaries represent a 24-hour period.
     */
    public static CanonicalBusinessInterval canonicalizeWorkPeriod(LocalTime start, LocalTime end) {
        Objects.requireNonNull(start, "start must not be null");
        Objects.requireNonNull(end, "end must not be null");

        int endDayOffset = start.isBefore(end) ? 0 : 1;
        return new CanonicalBusinessInterval(start, 0, end, endDayOffset);
    }

    /**
     * Resolves the unique positive placement of an interval contained by the work period.
     */
    public static CanonicalBusinessInterval resolveInside(
            CanonicalBusinessInterval workPeriod,
            LocalTime start,
            LocalTime end
    ) {
        Objects.requireNonNull(workPeriod, "workPeriod must not be null");
        Objects.requireNonNull(start, "start must not be null");
        Objects.requireNonNull(end, "end must not be null");

        List<CanonicalBusinessInterval> candidates = new ArrayList<>();
        for (int startDayOffset = 0; startDayOffset <= 1; startDayOffset++) {
            for (int endDayOffset = 0; endDayOffset <= 1; endDayOffset++) {
                CanonicalBusinessInterval candidate = positiveIntervalOrNull(
                        start,
                        startDayOffset,
                        end,
                        endDayOffset
                );
                if (candidate != null && workPeriod.contains(candidate)) {
                    candidates.add(candidate);
                }
            }
        }

        if (candidates.isEmpty()) {
            throw new IllegalArgumentException("interval cannot be placed inside work period");
        }
        if (candidates.size() > 1) {
            throw new IllegalArgumentException("interval placement inside work period is ambiguous");
        }
        return candidates.get(0);
    }

    private static CanonicalBusinessInterval positiveIntervalOrNull(
            LocalTime start,
            int startDayOffset,
            LocalTime end,
            int endDayOffset
    ) {
        int startMinute = startDayOffset * 24 * 60 + start.getHour() * 60 + start.getMinute();
        int endMinute = endDayOffset * 24 * 60 + end.getHour() * 60 + end.getMinute();
        if (endMinute <= startMinute) {
            return null;
        }
        return new CanonicalBusinessInterval(start, startDayOffset, end, endDayOffset);
    }
}
