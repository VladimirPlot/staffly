package ru.staffly.member.service;

import org.junit.jupiter.api.Test;
import ru.staffly.schedule.model.CanonicalBusinessInterval;
import ru.staffly.schedule.model.ScheduleCell;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PublishedShiftImpactClassifierTest {
    private final PublishedShiftImpactClassifier classifier = new PublishedShiftImpactClassifier();

    @Test
    void preservesCurrentOvernightShiftAndClassifiesFutureShiftForCancellation() {
        ScheduleCell currentOvernight = structured(LocalDate.of(2026, 9, 18),
                new CanonicalBusinessInterval(LocalTime.of(22, 0), 0, LocalTime.of(6, 0), 1));
        ScheduleCell future = structured(LocalDate.of(2026, 9, 19),
                new CanonicalBusinessInterval(LocalTime.of(22, 0), 0, LocalTime.of(6, 0), 1));
        ScheduleCell legacy = ScheduleCell.builder().day(LocalDate.of(2026, 9, 19)).value("10:00–18:00").build();

        var impact = classifier.classify(List.of(currentOvernight, future, legacy),
                LocalDateTime.of(2026, 9, 19, 2, 0));

        assertThat(impact.elapsedPreserved()).isZero();
        assertThat(impact.currentPreserved()).isEqualTo(1);
        assertThat(impact.futureToCancel()).isEqualTo(1);
        assertThat(impact.legacyUnstructuredPreserved()).isEqualTo(1);
    }

    private ScheduleCell structured(LocalDate day, CanonicalBusinessInterval interval) {
        ScheduleCell cell = ScheduleCell.builder().day(day).value("display-only").build();
        cell.setStructuredShift(interval);
        return cell;
    }
}
