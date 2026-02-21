package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;

@Entity
@Table(name = "training_exam")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingExam {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    @Column(name = "pass_percent", nullable = false)
    private int passPercent;

    @Column(name = "time_limit_sec")
    private Integer timeLimitSec;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = TimeProvider.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = TimeProvider.now();

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = TimeProvider.now(); if (updatedAt == null) updatedAt = TimeProvider.now(); }
    @PreUpdate
    void preUpdate() { updatedAt = TimeProvider.now(); }
}
