package ru.staffly.inventory.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class InventoryLayoutResponse {
    List<String> layout;
}
