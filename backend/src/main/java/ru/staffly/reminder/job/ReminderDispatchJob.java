package ru.staffly.reminder.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.staffly.reminder.service.ReminderDispatchService;
import ru.staffly.restaurant.repository.RestaurantRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class ReminderDispatchJob {
    private final RestaurantRepository restaurants;
    private final ReminderDispatchService dispatch;

    @Scheduled(cron = "0 */2 * * * *")
    public void dispatchReminders() {
        // The proxied worker commits/releases its mutex before the next restaurant.
        for (var restaurant : restaurants.findAll()) {
            try {
                dispatch.dispatchForRestaurant(restaurant);
            } catch (RuntimeException ex) {
                log.error("Failed to dispatch reminders for restaurant {}", restaurant.getId(), ex);
            }
        }
        log.info("Reminder dispatch job completed");
    }
}
