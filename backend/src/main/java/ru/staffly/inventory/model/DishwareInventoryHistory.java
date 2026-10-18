package ru.staffly.inventory.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Entity
@Table(name = "dishware_inventory_history")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DishwareInventoryHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long inventoryId;
    @Column(nullable = false) private Long restaurantId;
    @Column(nullable = false) private Long actorId;
    @Column(nullable = false, length = 255) private String actorName;
    @Column(nullable = false, length = 40) private String action;
    @Column(length = 1000) private String reason;
    @Column(nullable = false) private Instant occurredAt;
    @Column(columnDefinition = "text") private String beforeSnapshot;
    @Column(columnDefinition = "text") private String afterSnapshot;
}
