package ru.staffly.master_schedule.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.dictionary.model.Position;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "master_schedule_row",
        indexes = {
                @Index(name = "idx_master_schedule_row_schedule", columnList = "schedule_id"),
                @Index(name = "idx_master_schedule_row_position", columnList = "position_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterScheduleRow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private MasterSchedule schedule;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_id", nullable = false)
    private Position position;

    @Column(name = "row_index", nullable = false)
    private int rowIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "salary_handling", nullable = false, length = 20)
    @Builder.Default
    private SalaryHandling salaryHandling = SalaryHandling.PRORATE;

    @Column(name = "rate_override", precision = 12, scale = 2)
    private java.math.BigDecimal rateOverride;

    @Column(name = "amount_override", precision = 14, scale = 2)
    private java.math.BigDecimal amountOverride;

    @Enumerated(EnumType.STRING)
    @Column(name = "pay_type_override", length = 20)
    private PayType payTypeOverride;

    @Version
    private long version;

    @OneToMany(mappedBy = "row", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<MasterScheduleCell> cells = new ArrayList<>();
}
