package ru.staffly.member.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "position_change_audit")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PositionChangeAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "restaurant_id", nullable = false) private Long restaurantId;
    @Column(name = "actor_user_id", nullable = false) private Long actorUserId;
    @Column(name = "member_id", nullable = false) private Long memberId;
    @Column(name = "old_position_id", nullable = false) private Long oldPositionId;
    @Column(name = "new_position_id", nullable = false) private Long newPositionId;
    @Column(name = "old_position_name", nullable = false) private String oldPositionName;
    @Column(name = "new_position_name", nullable = false) private String newPositionName;
    @Enumerated(EnumType.STRING)
    @Column(name = "old_position_level", nullable = false) private ru.staffly.restaurant.model.RestaurantRole oldPositionLevel;
    @Enumerated(EnumType.STRING)
    @Column(name = "new_position_level", nullable = false) private ru.staffly.restaurant.model.RestaurantRole newPositionLevel;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt;
    @Column(nullable = false, columnDefinition = "text") private String details;
}
