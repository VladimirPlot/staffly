package ru.staffly.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.inventory.model.DishwareInventorySaveReceipt;
import java.util.Optional;
import java.util.UUID;

public interface DishwareInventorySaveReceiptRepository extends JpaRepository<DishwareInventorySaveReceipt, Long> {
    Optional<DishwareInventorySaveReceipt> findByInventoryIdAndRequestId(Long inventoryId, UUID requestId);
}
