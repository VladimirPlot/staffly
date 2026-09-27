package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** The effective time and demand vocabulary for a set of business weekdays. */
@Entity
@Table(name = "schedule_build_weekday_regime",
        indexes = @Index(name = "idx_sbwdr_position_config", columnList = "position_config_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildWeekdayRegime {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_config_id", nullable = false)
    private ScheduleBuildPositionConfig positionConfig;

    @ElementCollection
    @CollectionTable(name = "schedule_build_weekday_regime_day",
            joinColumns = @JoinColumn(name = "weekday_regime_id", nullable = false),
            uniqueConstraints = @UniqueConstraint(name = "uq_sbwdrd_regime_day",
                    columnNames = {"weekday_regime_id", "day_of_week"}))
    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 9)
    @Builder.Default
    private Set<DayOfWeek> daysOfWeek = new LinkedHashSet<>();

    @Column(name = "work_period_start", nullable = false)
    private LocalTime workPeriodStart;

    @Column(name = "work_period_end", nullable = false)
    private LocalTime workPeriodEnd;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;

    @OneToMany(mappedBy = "weekdayRegime", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<ScheduleBuildShiftOption> shiftOptions = new ArrayList<>();

    @OneToMany(mappedBy = "weekdayRegime", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("dayOfWeek ASC, sortOrder ASC, id ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<ScheduleBuildCoverageRule> coverageRules = new ArrayList<>();

    @OneToMany(mappedBy = "weekdayRegime", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("date ASC, id ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<ScheduleBuildCoverageDateOverride> coverageDateOverrides = new ArrayList<>();

    public boolean appliesTo(DayOfWeek day) {
        return daysOfWeek != null && daysOfWeek.contains(day);
    }
}
