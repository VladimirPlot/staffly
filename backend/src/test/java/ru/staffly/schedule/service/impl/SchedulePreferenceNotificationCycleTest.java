package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.Test;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.Schedule;

import static org.assertj.core.api.Assertions.assertThat;

class SchedulePreferenceNotificationCycleTest {
    @Test
    void completionDeduplicationIsStableWithinCycleAndChangesOnReopen() {
        Schedule schedule = Schedule.builder().id(4L).restaurant(Restaurant.builder().id(3L).build())
                .preferenceCollectionCycle(1).build();

        String first = SchedulePreferenceServiceImpl.allSubmittedMeta(schedule);
        assertThat(SchedulePreferenceServiceImpl.allSubmittedMeta(schedule)).isEqualTo(first);

        schedule.setPreferenceCollectionCycle(2);
        assertThat(SchedulePreferenceServiceImpl.allSubmittedMeta(schedule))
                .isEqualTo("schedulePreferences:allSubmitted:restaurant:3:schedule:4:cycle:2")
                .isNotEqualTo(first);
    }
}
