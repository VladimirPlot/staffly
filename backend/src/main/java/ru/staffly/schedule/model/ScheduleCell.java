package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "schedule_cell",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_schedule_cell_row_day", columnNames = {"row_id", "day"})
        },
        indexes = {
                @Index(name = "idx_schedule_cell_row", columnList = "row_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleCell {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "row_id", nullable = false)
    private ScheduleRow row;

    @Column(nullable = false)
    private LocalDate day;

    @Column(nullable = false, columnDefinition = "text")
    private String value;
}