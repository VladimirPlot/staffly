package ru.staffly.schedule.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;

/**
 * A time interval positioned on the business date or its following calendar date.
 */
public record CanonicalBusinessInterval(
        LocalTime startTime,
        int startDayOffset,
        LocalTime endTime,
        int endDayOffset
) {

    private static final int MINUTES_PER_DAY = 24 * 60;

    public CanonicalBusinessInterval {
        Objects.requireNonNull(startTime, "startTime must not be null");
        Objects.requireNonNull(endTime, "endTime must not be null");
        validateDayOffset(startDayOffset, "startDayOffset");
        validateDayOffset(endDayOffset, "endDayOffset");

        if (canonicalMinute(endTime, endDayOffset) <= canonicalMinute(startTime, startDayOffset)) {
            throw new IllegalArgumentException("end must be after start");
        }
    }

    public int startMinute() {
        return canonicalMinute(startTime, startDayOffset);
    }

    public int endMinute() {
        return canonicalMinute(endTime, endDayOffset);
    }

    public int durationMinutes() {
        return endMinute() - startMinute();
    }

    public LocalDateTime physicalStart(LocalDate businessDate) {
        Objects.requireNonNull(businessDate, "businessDate must not be null");
        return businessDate.plusDays(startDayOffset).atTime(startTime);
    }

    public LocalDateTime physicalEnd(LocalDate businessDate) {
        Objects.requireNonNull(businessDate, "businessDate must not be null");
        return businessDate.plusDays(endDayOffset).atTime(endTime);
    }

    public boolean overlaps(CanonicalBusinessInterval other) {
        Objects.requireNonNull(other, "other must not be null");
        return startMinute() < other.endMinute() && other.startMinute() < endMinute();
    }

    public boolean contains(CanonicalBusinessInterval other) {
        Objects.requireNonNull(other, "other must not be null");
        return startMinute() <= other.startMinute() && endMinute() >= other.endMinute();
    }

    public boolean containsMinute(int canonicalMinute) {
        return startMinute() <= canonicalMinute && canonicalMinute < endMinute();
    }

    private static int canonicalMinute(LocalTime time, int dayOffset) {
        return dayOffset * MINUTES_PER_DAY + time.getHour() * 60 + time.getMinute();
    }

    private static void validateDayOffset(int dayOffset, String fieldName) {
        if (dayOffset < 0 || dayOffset > 1) {
            throw new IllegalArgumentException(fieldName + " must be 0 or 1");
        }
    }
}
