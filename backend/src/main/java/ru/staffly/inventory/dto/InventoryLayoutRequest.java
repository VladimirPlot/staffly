package ru.staffly.inventory.dto;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class InventoryLayoutRequest {

    @NotEmpty
    private List<String> layout;
}
