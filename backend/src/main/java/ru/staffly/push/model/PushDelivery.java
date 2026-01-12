package ru.staffly.push.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "push_deliveries",
        indexes = {
                @Index(name = "idx_push_deliveries_status_run_at", columnList = "status,run_at"),
                @Index(name = "idx_push_deliveries_next_attempt_at", columnList = "next_attempt_at"),
                @Index(name = "idx_push_deliveries_user_id", columnList = "user_id"),
                @Index(name = "idx_push_deliveries_lock_owner", columnList = "lock_owner"),
                @Index(name = "idx_push_deliveries_locked_until", columnList = "locked_until")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushDelivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ref_type", nullable = false, length = 40)
    private String refType;

    @Column(name = "ref_id", nullable = false)
    private Long refId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(name = "restaurant_id", insertable = false, updatable = false)
    private Long restaurantId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "user_id", insertable = false, updatable = false)
    private Long userId;

    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PushDeliveryStatus status;

    @Column(name = "run_at", nullable = false)
    private Instant runAt;

    @Column(name = "attempts", nullable = false)
    private int attempts;

    @Column(name = "next_attempt_at")
    private Instant nextAttemptAt;

    @Column(name = "locked_until")
    private Instant lockedUntil;

    @Column(name = "lock_owner")
    private String lockOwner;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "last_error", columnDefinition = "text")
    private String lastError;

    @Column(name = "last_http_status")
    private Integer lastHttpStatus;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (runAt == null) {
            runAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}
