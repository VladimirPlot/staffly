package ru.staffly.anonymousletter.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;
import ru.staffly.common.time.TimeProvider;

import java.time.Instant;

@Entity
@Table(name = "anonymous_letter",
        indexes = {
                @Index(name = "idx_anonymous_letter_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_anonymous_letter_recipient", columnList = "recipient_member_id"),
                @Index(name = "idx_anonymous_letter_sender_created", columnList = "sender_id, created_at")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnonymousLetter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recipient_member_id", nullable = false)
    private RestaurantMember recipient;

    @Column(nullable = false, length = 50)
    private String subject;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "read_at")
    private Instant readAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = TimeProvider.now();
    }
}