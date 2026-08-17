package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "schedule_build_coverage_date_override",
        uniqueConstraints = @UniqueConstraint(name = "uq_sbcdo_config_date_shift", columnNames = {"position_config_id", "date", "shift_option_id"}),
        indexes = {
                @Index(name = "idx_sbcdo_position_config", columnList = "position_config_id"),
                @Index(name = "idx_sbcdo_date", columnList = "date"),
                @Index(name = "idx_sbcdo_shift_option", columnList = "shift_option_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildCoverageDateOverride {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_config_id", nullable = false)
    private ScheduleBuildPositionConfig positionConfig;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "shift_option_id", nullable = false)
    private ScheduleBuildShiftOption shiftOption;

    @Column(name = "required_count", nullable = false)
    private Integer requiredCount;
}
