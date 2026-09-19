package ru.staffly.schedule.model;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduleCellStructuredShiftTest {

    private static final LocalDate FRIDAY = LocalDate.of(2026, 9, 18);

    @Test
    void derivesPhysicalDatesForOvernightAndPostMidnightIntervals() {
        ScheduleCell overnight = cell("22:00-02:00");
        overnight.setStructuredShift(interval("22:00", 0, "02:00", 1));
        assertThat(overnight.physicalStart()).isEqualTo(LocalDateTime.of(2026, 9, 18, 22, 0));
        assertThat(overnight.physicalEnd()).isEqualTo(LocalDateTime.of(2026, 9, 19, 2, 0));

        ScheduleCell postMidnight = cell("00:00-06:00");
        postMidnight.setStructuredShift(interval("00:00", 1, "06:00", 1));
        assertThat(postMidnight.physicalStart()).isEqualTo(LocalDateTime.of(2026, 9, 19, 0, 0));
        assertThat(postMidnight.physicalEnd()).isEqualTo(LocalDateTime.of(2026, 9, 19, 6, 0));
    }

    @Test
    void neverInterpretsLegacyOrManualTextAsStructuredShift() {
        assertThat(cell("10:00-17:00").hasStructuredShift()).isFalse();
        assertThat(cell("Выходной").hasStructuredShift()).isFalse();
    }

    private ScheduleCell cell(String value) {
        return ScheduleCell.builder().day(FRIDAY).value(value).build();
    }

    private CanonicalBusinessInterval interval(String start, int startOffset, String end, int endOffset) {
        return new CanonicalBusinessInterval(LocalTime.parse(start), startOffset, LocalTime.parse(end), endOffset);
    }
}
