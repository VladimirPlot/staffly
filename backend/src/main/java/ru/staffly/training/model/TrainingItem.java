package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;

import ru.staffly.common.time.TimeProvider;

import java.time.Instant;

@Entity
@Table(name = "training_item",
        indexes = {
                @Index(name = "idx_training_item_category", columnList = "category_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TrainingItem {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private TrainingCategory category;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    // Для MENU (опционально)
    @Column(columnDefinition = "text")
    private String composition;

    @Column(columnDefinition = "text")
    private String allergens;

    // общее поле и для BAR и для MENU
    @Column(name = "image_url")
    private String imageUrl;

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