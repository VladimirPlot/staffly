package ru.staffly.notification.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;
import ru.staffly.member.model.RestaurantMember;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "notifications",
        indexes = {
                @Index(name = "idx_notifications_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_notifications_expires", columnList = "expires_at")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "expires_at", nullable = false)
    private LocalDate expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToMany
    @JoinTable(name = "notification_positions",
            joinColumns = @JoinColumn(name = "notification_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id"))
    @Builder.Default
    private Set<Position> positions = new HashSet<>();

    @ManyToMany
    @JoinTable(name = "notification_members",
            joinColumns = @JoinColumn(name = "notification_id"),
            inverseJoinColumns = @JoinColumn(name = "member_id"))
    @Builder.Default
    private Set<RestaurantMember> members = new HashSet<>();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}