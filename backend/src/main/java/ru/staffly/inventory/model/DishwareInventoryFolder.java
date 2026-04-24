package ru.staffly.inventory.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;

@Entity
@Table(
        name = "dishware_inventory_folder",
        indexes = {
                @Index(name = "idx_dishware_inventory_folder_restaurant_parent", columnList = "restaurant_id, parent_id"),
                @Index(name = "idx_dishware_inventory_folder_trash", columnList = "restaurant_id, trashed_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DishwareInventoryFolder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private DishwareInventoryFolder parent;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "trashed_at")
    private Instant trashedAt;

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
