package ru.staffly.checklist.service;

import ru.staffly.checklist.model.Checklist;
import ru.staffly.checklist.model.ChecklistPeriodicity;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;

final class ChecklistResetCalculator {

    private ChecklistResetCalculator() {
    }

    static Instant computeNextReset(Instant base, Checklist checklist, ZoneId zone) {
        ChecklistPeriodicity periodicity = checklist.getPeriodicity();
        LocalTime resetTime = checklist.getResetTime();
        if (periodicity == null || periodicity == ChecklistPeriodicity.MANUAL || resetTime == null || base == null) {
            return null;
        }

        ZonedDateTime baseZoned = base.atZone(zone);
        return switch (periodicity) {
            case DAILY -> {
                ZonedDateTime candidate = ZonedDateTime.of(baseZoned.toLocalDate(), resetTime, zone);
                if (!candidate.isAfter(baseZoned)) {
                    candidate = candidate.plusDays(1);
                }
                yield candidate.toInstant();
            }
            case WEEKLY -> {
                Integer dow = checklist.getResetDayOfWeek();
                if (dow == null || dow < 1 || dow > 7) {
                    yield null;
                }
                DayOfWeek target = DayOfWeek.of(dow);
                ZonedDateTime candidate = ZonedDateTime.of(baseZoned.toLocalDate(), resetTime, zone)
                        .with(TemporalAdjusters.nextOrSame(target));
                if (!candidate.isAfter(baseZoned)) {
                    candidate = candidate.plusWeeks(1);
                }
                yield candidate.toInstant();
            }
            case MONTHLY -> {
                Integer dom = checklist.getResetDayOfMonth();
                if (dom == null || dom < 1 || dom > 31) {
                    yield null;
                }
                LocalDate startDate = baseZoned.toLocalDate();
                int day = Math.min(dom, startDate.lengthOfMonth());
                ZonedDateTime candidate = ZonedDateTime.of(startDate.withDayOfMonth(day), resetTime, zone);
                if (!candidate.isAfter(baseZoned)) {
                    LocalDate nextMonth = startDate.plusMonths(1);
                    int nextDay = Math.min(dom, nextMonth.lengthOfMonth());
                    candidate = ZonedDateTime.of(nextMonth.withDayOfMonth(nextDay), resetTime, zone);
                }
                yield candidate.toInstant();
            }
            case MANUAL -> null;
        };
    }
}