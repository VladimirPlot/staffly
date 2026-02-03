package ru.staffly.dashboard.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.dashboard.dto.DashboardLayoutResponse;
import ru.staffly.dashboard.model.DashboardLayout;
import ru.staffly.dashboard.repository.DashboardLayoutRepository;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DashboardLayoutService {

    private static final List<String> DEFAULT_LAYOUT = List.of(
            "employees",
            "announcements",
            "contacts",
            "anonymous-letter",
            "schedule",
            "master-schedule",
            "training",
            "tasks",
            "checklists",
            "reminders"
    );

    private final DashboardLayoutRepository repository;

    @Transactional(readOnly = true)
    public DashboardLayoutResponse getLayout(Long restaurantId, Long userId) {
        return repository.findByUserIdAndRestaurantId(userId, restaurantId)
                .map(entity ->
                        DashboardLayoutResponse.builder()
                                .layout(normalizeLayout(entity.getLayout()))
                                .build()
                )
                .orElseGet(this::defaultLayout);
    }

    @Transactional
    public DashboardLayoutResponse saveLayout(
            Long restaurantId,
            Long userId,
            List<String> layout
    ) {
        List<String> normalized = normalizeLayout(layout);

        DashboardLayout entity = repository
                .findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseGet(() -> DashboardLayout.builder()
                        .userId(userId)
                        .restaurantId(restaurantId)
                        .layout(DEFAULT_LAYOUT)
                        .build()
                );

        entity.setLayout(normalized);
        repository.save(entity);

        return DashboardLayoutResponse.builder()
                .layout(normalized)
                .build();
    }

    private DashboardLayoutResponse defaultLayout() {
        return DashboardLayoutResponse.builder()
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

        for (String key : DEFAULT_LAYOUT) {
            order.add(key);
        }

        return new ArrayList<>(order);
    }
}
