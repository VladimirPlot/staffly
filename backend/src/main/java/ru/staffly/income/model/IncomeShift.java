package ru.staffly.income.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "income_shifts",
        indexes = {
                @Index(name = "idx_income_shifts_period", columnList = "period_id"),
                @Index(name = "idx_income_shifts_user", columnList = "user_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncomeShift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "period_id", nullable = false)
    private IncomePeriod period;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private IncomeShiftType type;

    @Column(name = "fixed_amount", precision = 16, scale = 2)
    private BigDecimal fixedAmount;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "hourly_rate", precision = 16, scale = 2)
    private BigDecimal hourlyRate;

    @Column(name = "tips_amount", precision = 16, scale = 2)
    private BigDecimal tipsAmount;

    @Column(name = "personal_revenue", precision = 16, scale = 2)
    private BigDecimal personalRevenue;

    @Column(columnDefinition = "text")
    private String comment;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}