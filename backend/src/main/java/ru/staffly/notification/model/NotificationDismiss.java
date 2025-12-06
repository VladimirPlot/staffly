package ru.staffly.notification.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.staffly.member.model.RestaurantMember;

import java.time.Instant;

@Entity
@Table(name = "notification_dismisses",
        uniqueConstraints = @UniqueConstraint(columnNames = {"notification_id", "member_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationDismiss {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "notification_id", nullable = false)
    private Notification notification;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private RestaurantMember member;

    @Column(name = "dismissed_at", nullable = false)
    private Instant dismissedAt;
}