package ru.staffly.member.model;

import jakarta.persistence.*;
import lombok.*;

import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.dictionary.model.PositionSpecialization;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "restaurant_member",
        indexes = {
                @Index(name = "idx_member_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_member_user", columnList = "user_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RestaurantMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Кто
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // Где
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_id", nullable = false)
    private Position position;

    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ended_by_user_id")
    private User endedByUser;

    @PrePersist
    void prePersist() {
        if (startedAt == null) startedAt = TimeProvider.now();
    }

    public boolean isActive() { return endedAt == null; }
    public RestaurantRole effectiveRole() { return position == null ? null : position.getLevel(); }
    public RestaurantRole getRole() { return effectiveRole(); }
    public java.util.Set<PositionSpecialization> specializations() {
        return position == null ? java.util.Set.of() : java.util.Set.copyOf(position.getSpecializations());
    }
    public void end(User actor, Instant at) {
        if (!isActive()) throw new IllegalStateException("Membership period has already ended");
        endedAt = java.util.Objects.requireNonNull(at, "at");
        endedByUser = java.util.Objects.requireNonNull(actor, "actor");
    }
}
