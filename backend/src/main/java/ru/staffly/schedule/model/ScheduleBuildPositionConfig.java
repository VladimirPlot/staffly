package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import ru.staffly.dictionary.model.Position;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule_build_position_config",
        indexes = {
                @Index(name = "idx_sbpc_template", columnList = "template_id"),
                @Index(name = "idx_sbpc_position", columnList = "position_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildPositionConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private ScheduleBuildTemplate template;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    private Position position;

    @ManyToMany
    @JoinTable(
            name = "schedule_build_position_config_position",
            joinColumns = @JoinColumn(name = "position_config_id", nullable = false),
            inverseJoinColumns = @JoinColumn(name = "position_id", nullable = false),
            uniqueConstraints = @UniqueConstraint(name = "uq_sbpcp_config_position", columnNames = {"position_config_id", "position_id"})
    )
    @OrderBy("name ASC, id ASC")
    @Builder.Default
    private List<Position> positions = new ArrayList<>();

    @Column(name = "full_shift_start", nullable = false)
    private LocalTime fullShiftStart;

    @Column(name = "full_shift_end", nullable = false)
    private LocalTime fullShiftEnd;

    @Column(name = "min_rest_hours")
    private Integer minRestHours;

    @Enumerated(EnumType.STRING)
    @Column(name = "min_rest_mode", nullable = false, length = 10)
    @Builder.Default
    private ScheduleBuildMinRestMode minRestMode = ScheduleBuildMinRestMode.SOFT;

    @Column(name = "max_shifts_per_period")
    private Integer maxShiftsPerPeriod;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_pattern", length = 20)
    private ScheduleBuildPattern targetPattern;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @ElementCollection
    @CollectionTable(
            name = "schedule_build_position_config_heavy_day",
            joinColumns = @JoinColumn(name = "position_config_id", nullable = false),
            uniqueConstraints = @UniqueConstraint(name = "uq_sbpc_heavy_day", columnNames = {"position_config_id", "day_of_week"})
    )
    @Column(name = "day_of_week", nullable = false)
    @OrderColumn(name = "sort_order")
    @Builder.Default
    private List<Integer> heavyDaysOfWeek = new ArrayList<>();

    @OneToMany(mappedBy = "positionConfig", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<ScheduleBuildShiftOption> shiftOptions = new ArrayList<>();

    @OneToMany(mappedBy = "positionConfig", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayOfWeek ASC, sortOrder ASC, id ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<ScheduleBuildCoverageRule> coverageRules = new ArrayList<>();
}
