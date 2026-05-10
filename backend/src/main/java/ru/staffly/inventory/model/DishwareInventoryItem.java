package ru.staffly.inventory.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "dishware_inventory_item",
        indexes = {
                @Index(name = "idx_dishware_inventory_item_inventory", columnList = "inventory_id, sort_order, id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DishwareInventoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inventory_id", nullable = false)
    private DishwareInventory inventory;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "photo_url", columnDefinition = "text")
    private String photoUrl;

    @Column(name = "previous_qty", nullable = false)
    @Builder.Default
    private int previousQty = 0;

    @Column(name = "incoming_qty", nullable = false)
    @Builder.Default
    private int incomingQty = 0;

    @Column(name = "current_qty", nullable = false)
    @Builder.Default
    private int currentQty = 0;

    @Column(name = "unit_price", precision = 12, scale = 2)
    private BigDecimal unitPrice;

    @Column(columnDefinition = "text")
    private String note;

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
