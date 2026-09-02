package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;

import java.time.Instant;

/** Cycle-scoped milestone storage for the future lifecycle integration. */
@Entity
@Table(name = "certification_assignment_cycle_notification_state")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CertificationAssignmentCycleNotificationState {
    @Id
    @Column(name = "assignment_cycle_id")
    private Long assignmentCycleId;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId
    @JoinColumn(name = "assignment_cycle_id", nullable = false)
    private CertificationAssignmentCycle assignmentCycle;

    @Column(name = "last_completed_milestone", nullable = false)
    @Builder.Default
    private int lastCompletedMilestone = 0;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = TimeProvider.now();

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = TimeProvider.now();
    }
}
