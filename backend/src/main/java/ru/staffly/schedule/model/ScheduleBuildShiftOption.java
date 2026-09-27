package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;

@Entity
@Table(name = "schedule_build_shift_option", indexes = @Index(name = "idx_sbso_weekday_regime", columnList = "weekday_regime_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildShiftOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "weekday_regime_id", nullable = false)
    private ScheduleBuildWeekdayRegime weekdayRegime;

    /** Optional soft-affinity marker owned by the same position configuration. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "marker_id")
    private ScheduleBuildMarker marker;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "label", length = 150)
    private String label;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}
