package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;

import java.time.Instant;

@Entity
@Table(name = "training_exam_notification_state")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingExamNotificationState {
    @Id
    @Column(name = "exam_id")
    private Long examId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "exam_id", nullable = false)
    private TrainingExam exam;

    @Column(name = "last_completed_milestone", nullable = false)
    @Builder.Default
    private int lastCompletedMilestone = 0;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = TimeProvider.now();

    @PrePersist
    void prePersist() {
        if (updatedAt == null) {
            updatedAt = TimeProvider.now();
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}