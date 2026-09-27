package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Optional;

@Entity
@Table(name = "schedule_cell",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_schedule_cell_row_day", columnNames = {"row_id", "day"})
        },
        indexes = {
                @Index(name = "idx_schedule_cell_row", columnList = "row_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleCell {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "row_id", nullable = false)
    private ScheduleRow row;

    @Column(nullable = false)
    private LocalDate day;

    @Column(nullable = false, columnDefinition = "text")
    private String value;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 32)
    private ScheduleCellSource source = ScheduleCellSource.MANUAL;

    @Column(name = "shift_start_time")
    private LocalTime shiftStartTime;

    @Column(name = "shift_start_day_offset")
    private Integer shiftStartDayOffset;

    @Column(name = "shift_end_time")
    private LocalTime shiftEndTime;

    @Column(name = "shift_end_day_offset")
    private Integer shiftEndDayOffset;

    public boolean hasStructuredShift() {
        return structuredShift().isPresent();
    }

    public Optional<CanonicalBusinessInterval> structuredShift() {
        boolean absent = shiftStartTime == null && shiftStartDayOffset == null
                && shiftEndTime == null && shiftEndDayOffset == null;
        if (absent) {
            return Optional.empty();
        }
        if (shiftStartTime == null || shiftStartDayOffset == null
                || shiftEndTime == null || shiftEndDayOffset == null) {
            throw new IllegalStateException("ScheduleCell has partial structured shift metadata");
        }
        return Optional.of(new CanonicalBusinessInterval(
                shiftStartTime, shiftStartDayOffset, shiftEndTime, shiftEndDayOffset));
    }

    public void setStructuredShift(CanonicalBusinessInterval interval) {
        if (interval == null) {
            shiftStartTime = null;
            shiftStartDayOffset = null;
            shiftEndTime = null;
            shiftEndDayOffset = null;
            return;
        }
        shiftStartTime = interval.startTime();
        shiftStartDayOffset = interval.startDayOffset();
        shiftEndTime = interval.endTime();
        shiftEndDayOffset = interval.endDayOffset();
    }

    public LocalDateTime physicalStart() {
        return structuredShift().orElseThrow(() -> new IllegalStateException("ScheduleCell is not a structured shift"))
                .physicalStart(day);
    }

    public LocalDateTime physicalEnd() {
        return structuredShift().orElseThrow(() -> new IllegalStateException("ScheduleCell is not a structured shift"))
                .physicalEnd(day);
    }
}
