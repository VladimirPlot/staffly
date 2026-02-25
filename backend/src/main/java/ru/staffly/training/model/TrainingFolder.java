package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "training_folder")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingFolder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private TrainingFolder parent;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TrainingFolderType type;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = TimeProvider.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = TimeProvider.now();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "training_folder_visibility",
            joinColumns = @JoinColumn(name = "folder_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id")
    )
    @Builder.Default
    private Set<Position> visibilityPositions = new HashSet<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = TimeProvider.now();
        if (updatedAt == null) updatedAt = TimeProvider.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}
