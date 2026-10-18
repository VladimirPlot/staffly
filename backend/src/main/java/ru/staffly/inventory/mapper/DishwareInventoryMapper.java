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
        Summary summary = summarize(entity.getItems(), entity.isIncludeSurplus());
        return new DishwareInventorySummaryDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getTitle(),
                entity.getInventoryDate(),
                entity.getStatus().name(),
                entity.getFolder() == null ? null : entity.getFolder().getId(),
                entity.getSortOrder(),
                entity.getSourceInventory() != null ? entity.getSourceInventory().getId() : null,
                entity.getSourceInventoryTitle(),
                entity.getComment(),
                summary.itemsCount(),
                summary.totalLossQty(),
                summary.totalLossAmount(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getCompletedAt(),
                entity.getTrashedAt(),
                entity.getVersion(),
                entity.isIncludeSurplus(),
                entity.isHasCorrections()
        );
    }

    public DishwareInventoryDto toDto(DishwareInventory entity) {
        List<DishwareInventoryItemDto> items = entity.getItems() == null
                ? List.of()
                : entity.getItems().stream()
                .sorted(Comparator.comparingInt(DishwareInventoryItem::getSortOrder).thenComparing(DishwareInventoryItem::getId, Comparator.nullsLast(Long::compareTo)))
                .map(item -> toItemDto(item, entity.isIncludeSurplus()))
                .toList();

        Summary summary = summarize(entity.getItems(), entity.isIncludeSurplus());
        return new DishwareInventoryDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getTitle(),
                entity.getInventoryDate(),
                entity.getStatus().name(),
                entity.getFolder() == null ? null : entity.getFolder().getId(),
                entity.getSortOrder(),
                entity.getSourceInventory() != null ? entity.getSourceInventory().getId() : null,
                entity.getSourceInventoryTitle(),
                entity.getComment(),
                summary.itemsCount(),
                summary.totalLossQty(),
                summary.totalLossAmount(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getCompletedAt(),
                entity.getTrashedAt(),
                items,
                entity.getVersion(),
                entity.isIncludeSurplus(),
                entity.isHasCorrections()
        );
    }

    public DishwareInventoryItemDto toItemDto(DishwareInventoryItem item) {
        return toItemDto(item, false);
    }

    private DishwareInventoryItemDto toItemDto(DishwareInventoryItem item, boolean includeSurplus) {
        Metrics metrics = metrics(item, includeSurplus);

        return new DishwareInventoryItemDto(
                item.getId(),
                item.getName(),
                item.getPhotoUrl(),
                item.getPreviousQty(),
                item.getIncomingQty(),
                item.getCurrentQty(),
                metrics.expectedQty(),
                item.getUnitPrice(),
                item.getSortOrder(),
                item.getNote(),
                metrics.diffQty(),
                metrics.lossQty(),
                metrics.gainQty(),
                metrics.lossAmount(),
                item.getClientKey()
        );
    }

    private Summary summarize(List<DishwareInventoryItem> items, boolean includeSurplus) {
        if (items == null || items.isEmpty()) {
            return new Summary(0, 0, BigDecimal.ZERO);
        }

        int totalLossQty = 0;
        BigDecimal totalLossAmount = BigDecimal.ZERO;
        for (DishwareInventoryItem item : items) {
            Metrics metrics = metrics(item, includeSurplus);
            totalLossQty += metrics.lossQty() - (includeSurplus ? metrics.gainQty() : 0);
            totalLossAmount = totalLossAmount.add(metrics.lossAmount());
        }

        return new Summary(items.size(), totalLossQty, totalLossAmount);
    }

    private Metrics metrics(DishwareInventoryItem item, boolean includeSurplus) {
        int expectedQty = item.getPreviousQty() + item.getIncomingQty();
        int diffQty = item.getCurrentQty() - expectedQty;
        int lossQty = Math.max(expectedQty - item.getCurrentQty(), 0);
        int gainQty = Math.max(item.getCurrentQty() - expectedQty, 0);
        BigDecimal lossAmount = item.getUnitPrice() == null
                ? BigDecimal.ZERO
                : item.getUnitPrice().multiply(BigDecimal.valueOf(lossQty - (includeSurplus ? gainQty : 0)));

        return new Metrics(expectedQty, diffQty, lossQty, gainQty, lossAmount);
    }

    private record Summary(int itemsCount, int totalLossQty, BigDecimal totalLossAmount) {}
    private record Metrics(int expectedQty, int diffQty, int lossQty, int gainQty, BigDecimal lossAmount) {}
}
