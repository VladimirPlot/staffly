package ru.staffly.push.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "push_devices",
        indexes = {
                @Index(name = "idx_push_devices_user_id", columnList = "user_id"),
                @Index(name = "idx_push_devices_disabled_at", columnList = "disabled_at")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PushDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "endpoint", nullable = false, columnDefinition = "text", unique = true)
    private String endpoint;

    @Column(name = "p256dh", nullable = false, columnDefinition = "text")
    private String p256dh;

    @Column(name = "auth", nullable = false, columnDefinition = "text")
    private String auth;

    @Column(name = "expiration_time")
    private Long expirationTime;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "platform", columnDefinition = "text")
    private String platform;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "last_seen_at")
    private Instant lastSeenAt;

    @Column(name = "disabled_at")
    private Instant disabledAt;

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        if (lastSeenAt == null) {
            lastSeenAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}
