package ru.staffly.task.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "task",
        indexes = {
                @Index(name = "idx_task_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_task_assigned_user", columnList = "assigned_user_id"),
                @Index(name = "idx_task_assigned_position", columnList = "assigned_position_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private TaskPriority priority;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    // Конкретный исполнитель для этой задачи. Должно быть null, если значение assignedToAll равно true.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_user_id")
    private User assignedUser;

    // Назначенный на должность сотрудник для этой задачи. Должно быть null, если значение assignedToAll равно true.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_position_id")
    private Position assignedPosition;

    // Если значение равно true, то задача назначается всем участникам, а значение assignedUser/assignedPosition должно быть равно null.
    @Column(name = "assigned_to_all", nullable = false)
    private boolean assignedToAll;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = TimeProvider.now();
        }
        if (status == null) {
            status = TaskStatus.ACTIVE;
        }
    }
}