package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "schedule_preference_cell",
        indexes = {
                @Index(name = "idx_schedule_pref_cell_submission", columnList = "submission_id"),
                @Index(name = "idx_schedule_pref_cell_day", columnList = "day"),
                @Index(name = "idx_schedule_pref_cell_type", columnList = "type")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SchedulePreferenceCell {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private SchedulePreferenceSubmission submission;

    @Column(name = "day", nullable = false)
    private LocalDate day;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private SchedulePreferenceType type;

    @Column(name = "full_day", nullable = false)
    private boolean fullDay;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "note", columnDefinition = "text")
    private String note;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;
}
