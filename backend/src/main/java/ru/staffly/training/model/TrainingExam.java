package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

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

    @Enumerated(EnumType.STRING)
    @Column(name = "mode", nullable = false, length = 20)
    @Builder.Default
    private TrainingExamMode mode = TrainingExamMode.CERTIFICATION;

    @Column(name = "attempt_limit")
    private Integer attemptLimit;

    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = TimeProvider.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = TimeProvider.now();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "training_exam_visibility",
            joinColumns = @JoinColumn(name = "exam_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id")
    )
    @Builder.Default
    private Set<Position> visibilityPositions = new HashSet<>();

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = TimeProvider.now(); if (updatedAt == null) updatedAt = TimeProvider.now(); }
    @PreUpdate
    void preUpdate() { updatedAt = TimeProvider.now(); }
}
