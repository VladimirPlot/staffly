package ru.staffly.inbox.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "inbox_messages",
        indexes = {
                @Index(name = "idx_inbox_messages_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_inbox_messages_type", columnList = "type"),
                @Index(name = "idx_inbox_messages_expires", columnList = "expires_at"),
                @Index(name = "idx_inbox_messages_restaurant_type", columnList = "restaurant_id,type"),
                @Index(name = "idx_inbox_messages_restaurant_type_created", columnList = "restaurant_id,type,created_at")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_inbox_message_restaurant_type_meta", columnNames = {"restaurant_id", "type", "meta"})
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InboxMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private InboxMessageType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_subtype", length = 40)
    private InboxEventSubtype eventSubtype;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "expires_at")
    private LocalDate expiresAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private User createdBy;

    @Column(name = "meta", columnDefinition = "text", nullable = false)
    private String meta;

    @ManyToMany
    @JoinTable(name = "inbox_message_positions",
            joinColumns = @JoinColumn(name = "message_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id"))
    @Builder.Default
    private Set<Position> positions = new HashSet<>();

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}