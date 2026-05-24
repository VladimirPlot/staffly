package ru.staffly.inventory.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.inventory.dto.InventoryLayoutResponse;
import ru.staffly.inventory.model.InventoryLayout;
import ru.staffly.inventory.repository.InventoryLayoutRepository;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InventoryLayoutService {

    private static final List<String> DEFAULT_LAYOUT = List.of("dishware", "bar", "kitchen");

    private final InventoryLayoutRepository repository;

    @Transactional(readOnly = true)
    public InventoryLayoutResponse getLayout(Long restaurantId, Long userId) {
        return repository.findByUserIdAndRestaurantId(userId, restaurantId)
                .map(entity -> InventoryLayoutResponse.builder()
                        .layout(normalizeLayout(entity.getLayout()))
                        .build())
                .orElseGet(this::defaultLayout);
    }

    @Transactional
    public InventoryLayoutResponse saveLayout(Long restaurantId, Long userId, List<String> layout) {
        List<String> normalized = normalizeLayout(layout);

        InventoryLayout entity = repository.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseGet(() -> InventoryLayout.builder()
                        .userId(userId)
                        .restaurantId(restaurantId)
                        .layout(DEFAULT_LAYOUT)
                        .build());

        entity.setLayout(normalized);
        repository.save(entity);

        return InventoryLayoutResponse.builder()
                .layout(normalized)
                .build();
    }

    private InventoryLayoutResponse defaultLayout() {
        return InventoryLayoutResponse.builder()
                .layout(DEFAULT_LAYOUT)
                .build();
    }

    private List<String> normalizeLayout(List<String> layout) {
        LinkedHashSet<String> order = new LinkedHashSet<>();
        if (layout != null) {
            for (String key : layout) {
                if (DEFAULT_LAYOUT.contains(key)) {
                    order.add(key);
                }
            }
        }
        order.addAll(DEFAULT_LAYOUT);
        return new ArrayList<>(order);
    }
}
