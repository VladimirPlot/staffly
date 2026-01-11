package ru.staffly.income.model;

import jakarta.persistence.*;
import lombok.*;

import ru.staffly.common.time.TimeProvider;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "income_periods",
        indexes = {
                @Index(name = "idx_income_periods_user", columnList = "user_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncomePeriod {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @OneToMany(mappedBy = "period", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<IncomeShift> shifts = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = TimeProvider.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = TimeProvider.now();

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}