package ru.staffly.invite.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "invitation",
        indexes = {
                @Index(name = "idx_invitation_restaurant", columnList = "restaurant_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Invitation {
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name="task_decisions", columnDefinition="jsonb") @Builder.Default
    private java.util.List<ru.staffly.task.dto.TaskAudienceDecision> taskDecisions = new java.util.ArrayList<>();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // В какой ресторан приглашаем
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    // Телефон или email, как в миграции
    @Column(name = "phone_or_email", nullable = false, length = 255)
    private String phoneOrEmail;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "position_snapshot", columnDefinition = "jsonb", updatable = false)
    private AdmissionPositionSnapshot positionSnapshot;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "accepted_member_id")
    private ru.staffly.member.model.RestaurantMember acceptedMember;

    // Уникальный токен
    @Column(nullable = false, length = 64, unique = true)
    private String token;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InvitationStatus status;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    // Кто пригласил (может быть удалён)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by")
    private User invitedBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = TimeProvider.now();
        if (status == null) status = InvitationStatus.PENDING;
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "desired_role", nullable = false, length = 20)
    /** Legacy/display snapshot, not authority: access is derived from Position.level. */
    private RestaurantRole desiredRole;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "position_id")
    private Position position;
}
