package ru.staffly.inventory.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "dishware_inventory",
        indexes = {
                @Index(name = "idx_dishware_inventory_restaurant_date", columnList = "restaurant_id, inventory_date, updated_at"),
                @Index(name = "idx_dishware_inventory_source", columnList = "source_inventory_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DishwareInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_inventory_id")
    private DishwareInventory sourceInventory;

    @Column(name = "source_inventory_title", length = 255)
    private String sourceInventoryTitle;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "inventory_date", nullable = false)
    private LocalDate inventoryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DishwareInventoryStatus status;

    @Column(columnDefinition = "text")
    private String comment;

    @OneToMany(mappedBy = "inventory", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DishwareInventoryItem> items = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = TimeProvider.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = TimeProvider.now();

    @Column(name = "completed_at")
    private Instant completedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = TimeProvider.now();
        if (updatedAt == null) updatedAt = TimeProvider.now();
        if (status == null) status = DishwareInventoryStatus.DRAFT;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}
