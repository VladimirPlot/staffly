package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "training_exam_assignment",
        indexes = {
                @Index(name = "idx_training_exam_assignment_exam", columnList = "exam_id"),
                @Index(name = "idx_training_exam_assignment_restaurant_user", columnList = "restaurant_id,user_id"),
                @Index(name = "idx_training_exam_assignment_status", columnList = "status"),
                @Index(name = "idx_training_exam_assignment_active", columnList = "is_active")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingExamAssignment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private TrainingExam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_position_id")
    private Position assignedPosition;

    /**
     * Timestamp of the initial assignment creation (not reset between cycles).
     */
    @Column(name = "assigned_at", nullable = false)
    @Builder.Default
    private Instant assignedAt = TimeProvider.now();

    /**
     * Attempts limit snapshot for the current cycle; refreshed only on cycle reset.
     */
    @Column(name = "attempts_limit_snapshot")
    private Integer attemptsLimitSnapshot;

    @Column(name = "exam_version_snapshot", nullable = false)
    private int examVersionSnapshot;

    @Column(name = "extra_attempts", nullable = false)
    @Builder.Default
    private int extraAttempts = 0;

    @Column(name = "attempts_used", nullable = false)
    @Builder.Default
    private int attemptsUsed = 0;

    @Column(name = "best_score")
    private Integer bestScore;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;

    @Column(name = "passed_at")
    private Instant passedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private TrainingExamAssignmentStatus status = TrainingExamAssignmentStatus.ASSIGNED;

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
    void prePersist() {
        if (assignedAt == null) {
            assignedAt = TimeProvider.now();
        }
        if (createdAt == null) {
            createdAt = TimeProvider.now();
        }
        if (updatedAt == null) {
            updatedAt = TimeProvider.now();
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}