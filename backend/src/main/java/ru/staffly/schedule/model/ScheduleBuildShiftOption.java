package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;

@Entity
@Table(name = "schedule_build_shift_option", indexes = @Index(name = "idx_sbso_position_config", columnList = "position_config_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildShiftOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_config_id", nullable = false)
    private ScheduleBuildPositionConfig positionConfig;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "label", length = 150)
    private String label;

    @Column(name = "is_full_shift", nullable = false)
    @Builder.Default
    private boolean isFullShift = false;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}
