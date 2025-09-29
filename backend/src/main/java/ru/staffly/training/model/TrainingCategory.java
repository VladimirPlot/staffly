package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "training_category",
        indexes = {
                @Index(name = "idx_training_category_restaurant", columnList = "restaurant_id"),
                @Index(name = "idx_training_category_module", columnList = "module")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingCategory {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Enumerated(EnumType.STRING)
    @Column(name = "module", nullable = false, length = 20)
    private TrainingModule module;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    // видимость для позиций
    @ManyToMany
    @JoinTable(
            name = "training_category_position",
            joinColumns = @JoinColumn(name = "category_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id")
    )
    @Builder.Default
    private Set<Position> visibleForPositions = new LinkedHashSet<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = Instant.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}