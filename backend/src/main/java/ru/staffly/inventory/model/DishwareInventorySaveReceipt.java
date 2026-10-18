package ru.staffly.inventory.model;

import jakarta.persistence.*;
import lombok.*;
import java.util.UUID;

@Entity
@Table(name = "dishware_inventory_save_receipt", uniqueConstraints = @UniqueConstraint(columnNames = {"inventory_id", "request_id"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class DishwareInventorySaveReceipt {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "inventory_id", nullable = false)
    @org.hibernate.annotations.OnDelete(action = org.hibernate.annotations.OnDeleteAction.CASCADE)
    private DishwareInventory inventory;
    @Column(name = "request_id", nullable = false)
    private UUID requestId;
    @Column(name = "payload_hash", nullable = false, length = 64)
    private String payloadHash;
    @Column(name = "applied_version", nullable = false)
    private long appliedVersion;
}
