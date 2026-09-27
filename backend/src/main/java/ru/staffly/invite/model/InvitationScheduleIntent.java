package ru.staffly.invite.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.Instant;

@Entity
@Table(name = "invitation_schedule_intent",
        uniqueConstraints = @UniqueConstraint(name = "uq_invitation_schedule_intent_invitation_schedule",
                columnNames = {"invitation_id", "expected_schedule_id"}),
        indexes = @Index(name = "idx_invitation_schedule_intent_invitation", columnList = "invitation_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InvitationScheduleIntent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invitation_id", nullable = false)
    private Invitation invitation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schedule_id")
    private Schedule schedule;

    /** Immutable identity retained when the referenced schedule is physically deleted. */
    @Column(name = "expected_schedule_id", nullable = false, updatable = false)
    private Long expectedScheduleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "selected_action", nullable = false, length = 48)
    private InvitationScheduleIntentAction selectedAction;

    @Column(name = "requested_deadline")
    private Instant requestedDeadline;

    @Column(name = "expected_schedule_version", nullable = false)
    private Long expectedScheduleVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "expected_schedule_status", nullable = false, length = 32)
    private ScheduleStatus expectedScheduleStatus;

    @Column(name = "expected_collection_cycle", nullable = false)
    private long expectedCollectionCycle;

    @Column(name = "expected_preference_deadline")
    private Instant expectedPreferenceDeadline;

    @Enumerated(EnumType.STRING)
    @Column(name = "expected_preference_mode", length = 32)
    private PreferenceCollectionMode expectedPreferenceMode;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = TimeProvider.now();
    }
}
