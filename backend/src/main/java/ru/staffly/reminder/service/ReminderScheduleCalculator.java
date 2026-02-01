package ru.staffly.reminder.service;

import ru.staffly.reminder.model.Reminder;
import ru.staffly.reminder.model.ReminderPeriodicity;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

public final class ReminderScheduleCalculator {

    private ReminderScheduleCalculator() {
    }

    public static Instant computeNextFire(Instant base, Reminder reminder, ZoneId zone) {
        if (base == null || reminder == null) {
            return null;
        }
        ReminderPeriodicity periodicity = reminder.getPeriodicity();
        LocalTime time = reminder.getTime();
        if (periodicity == null || time == null) {
            return null;
        }
        ZonedDateTime baseZoned = base.atZone(zone);

        return switch (periodicity) {
            case DAILY -> {
                ZonedDateTime candidate = ZonedDateTime.of(baseZoned.toLocalDate(), time, zone);
                if (!candidate.isAfter(baseZoned)) {
                    candidate = candidate.plusDays(1);
                }
                yield candidate.toInstant();
            }
            case WEEKLY -> {
                Integer dow = reminder.getDayOfWeek();
                if (dow == null || dow < 1 || dow > 7) {
                    yield null;
                }
                DayOfWeek target = DayOfWeek.of(dow);
                ZonedDateTime candidate = ZonedDateTime.of(baseZoned.toLocalDate(), time, zone)
                        .with(TemporalAdjusters.nextOrSame(target));
                if (!candidate.isAfter(baseZoned)) {
                    candidate = candidate.plusWeeks(1);
                }
                yield candidate.toInstant();
            }
            case MONTHLY -> {
                LocalDate startDate = baseZoned.toLocalDate();
                ZonedDateTime candidate = monthlyCandidate(startDate, reminder, time, zone);
                if (candidate == null) {
                    yield null;
                }
                if (!candidate.isAfter(baseZoned)) {
                    LocalDate nextMonth = startDate.plusMonths(1);
                    candidate = monthlyCandidate(nextMonth, reminder, time, zone);
                }
                yield candidate == null ? null : candidate.toInstant();
            }
            case ONCE -> {
                LocalDate date = reminder.getOnceDate();
                if (date == null) {
                    yield null;
                }
                yield ZonedDateTime.of(date, time, zone).toInstant();
            }
        };
    }

    private static ZonedDateTime monthlyCandidate(LocalDate date, Reminder reminder, LocalTime time, ZoneId zone) {
        if (date == null) {
            return null;
        }
        if (reminder.isMonthlyLastDay()) {
            LocalDate lastDay = date.with(TemporalAdjusters.lastDayOfMonth());
            return ZonedDateTime.of(lastDay, time, zone);
        }
        Integer dom = reminder.getDayOfMonth();
        if (dom == null || dom < 1 || dom > 31) {
            return null;
        }
        int day = Math.min(dom, date.lengthOfMonth());
        return ZonedDateTime.of(date.withDayOfMonth(day), time, zone);
    }
}
