package ru.staffly.announcement.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.restaurant.model.Restaurant;

import java.util.UUID;

/** Survives manual deletion so a delayed retry cannot resurrect a deleted announcement. */
@Entity
@Table(name = "announcement_operations", uniqueConstraints = @UniqueConstraint(
        name = "uq_announcement_operation", columnNames = {"restaurant_id", "actor_id", "operation_id"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnouncementOperation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    @Column(name = "operation_id", nullable = false)
    private UUID operationId;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "message_id")
    private Long messageId;
}
