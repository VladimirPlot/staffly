package ru.staffly.schedule.model;

import ru.staffly.dictionary.model.Position;

import java.util.List;
import java.util.Objects;

/** Domain helpers for the normalized Schedule-to-Position association. */
public final class SchedulePositionIds {

    private SchedulePositionIds() {
    }

    public static List<Long> ids(Schedule schedule) {
        if (schedule == null || schedule.getPositions() == null) {
            return List.of();
        }
        return schedule.getPositions().stream()
                .map(Position::getId)
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }
}
