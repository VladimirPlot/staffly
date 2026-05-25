package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;

@Entity
@Table(name = "schedule_build_coverage_rule",
        indexes = {
                @Index(name = "idx_sbcr_position_config", columnList = "position_config_id"),
                @Index(name = "idx_sbcr_day_of_week", columnList = "day_of_week")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildCoverageRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_config_id", nullable = false)
    private ScheduleBuildPositionConfig positionConfig;

    @Column(name = "day_of_week", nullable = false)
    private Integer dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "required_count", nullable = false)
    private Integer requiredCount;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}
