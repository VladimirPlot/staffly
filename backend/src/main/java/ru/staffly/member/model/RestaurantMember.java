package ru.staffly.member.model;

import jakarta.persistence.*;
import lombok.*;

import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "restaurant_member",
        indexes = {
                @Index(name = "idx_member_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_member_user", columnList = "user_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_member_user_restaurant", columnNames = {"user_id","restaurant_id"})
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

    // Роль в контексте ресторана
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RestaurantRole role;

    // Должность (опционально)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    private Position position;

    // Ссылка/путь на аватар (для dev — локальный)
    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}