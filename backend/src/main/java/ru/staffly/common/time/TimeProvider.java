package ru.staffly.common.time;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Objects;

public final class TimeProvider {

    private static volatile Clock clock = Clock.systemUTC();

    private TimeProvider() {
    }

    public static Instant now() {
        return clock.instant();
    }

    public static LocalDate todayUtc() {
        return LocalDate.now(clock);
    }

    public static LocalDate today(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone));
    }

    public static LocalDateTime nowUtc() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    public static Clock clock() {
        return clock;
    }

    public static void setClock(Clock newClock) {
        clock = Objects.requireNonNull(newClock, "clock");
    }
}