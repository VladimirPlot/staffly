package ru.staffly.inventory.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.inventory.dto.DishwareInventoryDto;
import ru.staffly.inventory.dto.DishwareInventoryItemDto;
import ru.staffly.inventory.dto.DishwareInventorySummaryDto;
import ru.staffly.inventory.model.DishwareInventory;
import ru.staffly.inventory.model.DishwareInventoryItem;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

@Component
public class DishwareInventoryMapper {

    public DishwareInventorySummaryDto toSummaryDto(DishwareInventory entity) {
        Summary summary = summarize(entity.getItems());
        return new DishwareInventorySummaryDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getTitle(),
                entity.getInventoryDate(),
                entity.getStatus().name(),
                entity.getSourceInventory() != null ? entity.getSourceInventory().getId() : null,
                entity.getSourceInventoryTitle(),
                entity.getComment(),
                summary.itemsCount(),
                summary.totalLossQty(),
                summary.totalLossAmount(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getCompletedAt()
        );
    }

    public DishwareInventoryDto toDto(DishwareInventory entity) {
        List<DishwareInventoryItemDto> items = entity.getItems() == null
                ? List.of()
                : entity.getItems().stream()
                .sorted(Comparator.comparingInt(DishwareInventoryItem::getSortOrder).thenComparing(DishwareInventoryItem::getId, Comparator.nullsLast(Long::compareTo)))
                .map(this::toItemDto)
                .toList();

        Summary summary = summarize(entity.getItems());
        return new DishwareInventoryDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getTitle(),
                entity.getInventoryDate(),
                entity.getStatus().name(),
                entity.getSourceInventory() != null ? entity.getSourceInventory().getId() : null,
                entity.getSourceInventoryTitle(),
                entity.getComment(),
                summary.itemsCount(),
                summary.totalLossQty(),
                summary.totalLossAmount(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getCompletedAt(),
                items
        );
    }

    public DishwareInventoryItemDto toItemDto(DishwareInventoryItem item) {
        int diffQty = item.getCurrentQty() - item.getPreviousQty();
        int lossQty = Math.max(item.getPreviousQty() - item.getCurrentQty(), 0);
        int gainQty = Math.max(item.getCurrentQty() - item.getPreviousQty(), 0);
        BigDecimal lossAmount = item.getUnitPrice() == null
                ? BigDecimal.ZERO
                : item.getUnitPrice().multiply(BigDecimal.valueOf(lossQty));

        return new DishwareInventoryItemDto(
                item.getId(),
                item.getName(),
                item.getPhotoUrl(),
                item.getPreviousQty(),
                item.getCurrentQty(),
                item.getUnitPrice(),
                item.getSortOrder(),
                item.getNote(),
                diffQty,
                lossQty,
                gainQty,
                lossAmount
        );
    }

    private Summary summarize(List<DishwareInventoryItem> items) {
        if (items == null || items.isEmpty()) {
            return new Summary(0, 0, BigDecimal.ZERO);
        }

        int totalLossQty = 0;
        BigDecimal totalLossAmount = BigDecimal.ZERO;
        for (DishwareInventoryItem item : items) {
            int lossQty = Math.max(item.getPreviousQty() - item.getCurrentQty(), 0);
            totalLossQty += lossQty;
            if (item.getUnitPrice() != null && lossQty > 0) {
                totalLossAmount = totalLossAmount.add(item.getUnitPrice().multiply(BigDecimal.valueOf(lossQty)));
            }
        }

        return new Summary(items.size(), totalLossQty, totalLossAmount);
    }

    private record Summary(int itemsCount, int totalLossQty, BigDecimal totalLossAmount) {}
}
