package ru.staffly.inventory.service;

import ru.staffly.inventory.model.DishwareInventoryStatus;

import java.time.LocalDate;
import java.util.List;

public record DishwareInventoryPrintForm(
        String fileName,
        String title,
        LocalDate inventoryDate,
        DishwareInventoryStatus status,
        List<Item> items
) {

    public record Item(
            Long id,
            String name,
            int previousQty,
            int incomingQty,
            String photoUrl
    ) {
    }
}
