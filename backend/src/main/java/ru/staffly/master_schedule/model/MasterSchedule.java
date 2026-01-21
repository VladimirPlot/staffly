package ru.staffly.master_schedule.model;

import jakarta.persistence.*;
import lombok.*;

import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "master_schedule",
        indexes = {
                @Index(name = "idx_master_schedule_restaurant", columnList = "restaurant_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "planned_revenue", precision = 14, scale = 2)
    private java.math.BigDecimal plannedRevenue;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Version
    private long version;

    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<MasterScheduleRow> rows = new ArrayList<>();

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public void markDeleted() {
        this.deletedAt = TimeProvider.now();
    }
}
