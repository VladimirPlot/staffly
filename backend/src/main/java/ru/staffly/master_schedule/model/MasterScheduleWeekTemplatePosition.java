package ru.staffly.master_schedule.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.dictionary.model.Position;

@Entity
@Table(
        name = "master_schedule_week_template_position",
        indexes = {
                @Index(name = "idx_ms_week_template_position_schedule", columnList = "schedule_id"),
                @Index(name = "idx_ms_week_template_position_position", columnList = "position_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_ms_week_template_position_schedule_position",
                        columnNames = {"schedule_id", "position_id"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterScheduleWeekTemplatePosition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private MasterSchedule schedule;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_id", nullable = false)
    private Position position;
}
