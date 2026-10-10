package ru.staffly.checklist.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.staffly.checklist.repository.ChecklistRepository;
import ru.staffly.checklist.service.ChecklistService;

@Slf4j
@Component
@RequiredArgsConstructor
public class ChecklistResetJob {
    private final ChecklistRepository checklists;
    private final ChecklistService service;

    @Scheduled(cron = "0 * * * * *")
    public void resetDueChecklists() {
        for (Long restaurantId : checklists.findAutoResetRestaurantIds()) {
            try {
                service.processAutomaticResets(restaurantId);
            } catch (RuntimeException ex) {
                log.error("Failed to reset checklists for restaurant {}", restaurantId, ex);
            }
        }
    }
}
