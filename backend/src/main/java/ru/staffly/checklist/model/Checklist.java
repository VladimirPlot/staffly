package ru.staffly.checklist.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "checklist",
        indexes = {
                @Index(name = "idx_checklist_restaurant", columnList = "restaurant_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Checklist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Builder.Default
    @ManyToMany
    @JoinTable(name = "checklist_position",
            joinColumns = @JoinColumn(name = "checklist_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id"))
    private Set<Position> positions = new HashSet<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}