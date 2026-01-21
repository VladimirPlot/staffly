package ru.staffly.master_schedule.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.dictionary.model.Position;

import java.math.BigDecimal;
import java.time.DayOfWeek;

@Entity
@Table(
        name = "master_schedule_week_template_cell",
        indexes = {
                @Index(name = "idx_ms_week_template_cell_schedule", columnList = "schedule_id"),
                @Index(name = "idx_ms_week_template_cell_position", columnList = "position_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_ms_week_template_cell_schedule_position_day",
                        columnNames = {"schedule_id", "position_id", "weekday"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterScheduleWeekTemplateCell {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private MasterSchedule schedule;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_id", nullable = false)
    private Position position;

    @Enumerated(EnumType.STRING)
    @Column(name = "weekday", nullable = false, length = 10)
    private DayOfWeek weekday;

    @Column(name = "staff_count")
    private Integer staffCount;

    @Column(name = "units", precision = 12, scale = 2)
    private BigDecimal units;
}
