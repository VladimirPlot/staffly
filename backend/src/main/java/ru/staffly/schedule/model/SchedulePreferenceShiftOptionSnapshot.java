package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.LocalTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "schedule_preference_shift_option_snapshot",
        uniqueConstraints = @UniqueConstraint(name = "uq_spsos_schedule_source",
                columnNames = {"schedule_id", "source_shift_option_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SchedulePreferenceShiftOptionSnapshot {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    // Historical identifier only: deliberately no FK to the mutable live option.
    @Column(name = "source_shift_option_id", nullable = false)
    private Long sourceShiftOptionId;

    @Column(name = "label", length = 150)
    private String label;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @ElementCollection
    @BatchSize(size = 64)
    @CollectionTable(name = "schedule_preference_shift_option_snapshot_position",
            joinColumns = @JoinColumn(name = "snapshot_id"))
    @Column(name = "position_id", nullable = false)
    @Builder.Default
    private Set<Long> positionIds = new LinkedHashSet<>();
}
