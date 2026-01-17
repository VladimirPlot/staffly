package ru.staffly.master_schedule.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "master_schedule_cell",
        uniqueConstraints = {
                @UniqueConstraint(name = "ux_master_schedule_cell_row_date", columnNames = {"row_id", "work_date"})
        },
        indexes = {
                @Index(name = "idx_master_schedule_cell_row", columnList = "row_id"),
                @Index(name = "idx_master_schedule_cell_date", columnList = "work_date")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterScheduleCell {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "row_id", nullable = false)
    private MasterScheduleRow row;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "value_raw", length = 64)
    private String valueRaw;

    @Column(name = "value_num", precision = 12, scale = 2)
    private java.math.BigDecimal valueNum;

    @Column(name = "units_count")
    private Integer unitsCount;

    @Version
    private long version;
}