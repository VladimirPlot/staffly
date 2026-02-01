package ru.staffly.reminder.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(name = "reminder",
        indexes = {
                @Index(name = "idx_reminder_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_reminder_restaurant_active", columnList = "restaurant_id, active"),
                @Index(name = "idx_reminder_restaurant_next_fire_at", columnList = "restaurant_id, next_fire_at"),
                @Index(name = "idx_reminder_target_member", columnList = "target_member_id"),
                @Index(name = "idx_reminder_target_position", columnList = "target_position_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Reminder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by_member_id", nullable = false)
    private RestaurantMember createdByMember;

    @Column(name = "visible_to_admin", nullable = false)
    private boolean visibleToAdmin;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private ReminderTargetType targetType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_position_id")
    private Position targetPosition;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_member_id")
    private RestaurantMember targetMember;

    @Enumerated(EnumType.STRING)
    @Column(name = "periodicity", nullable = false, length = 20)
    private ReminderPeriodicity periodicity;

    @Column(name = "time_hhmm", nullable = false)
    private LocalTime time;

    @Column(name = "day_of_week")
    private Integer dayOfWeek;

    @Column(name = "day_of_month")
    private Integer dayOfMonth;

    @Column(name = "monthly_last_day", nullable = false)
    private boolean monthlyLastDay;

    @Column(name = "once_date")
    private LocalDate onceDate;

    @Column(name = "next_fire_at")
    private Instant nextFireAt;

    @Column(name = "last_fired_at")
    private Instant lastFiredAt;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}
