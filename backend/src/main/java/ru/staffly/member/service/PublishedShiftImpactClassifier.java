package ru.staffly.member.service;

import org.springframework.stereotype.Component;
import ru.staffly.member.dto.PositionChangeImpactPlan.PublishedShiftImpact;
import ru.staffly.schedule.model.ScheduleCell;

import java.time.LocalDateTime;
import java.util.Collection;

@Component
public class PublishedShiftImpactClassifier {

    public PublishedShiftImpact classify(Collection<ScheduleCell> cells, LocalDateTime restaurantNow) {
        int elapsed = 0;
        int current = 0;
        int future = 0;
        int legacy = 0;
        for (ScheduleCell cell : cells) {
            if (!cell.hasStructuredShift()) {
                legacy++;
            } else if (!cell.physicalEnd().isAfter(restaurantNow)) {
                elapsed++;
            } else if (!cell.physicalStart().isAfter(restaurantNow)) {
                current++;
            } else {
                future++;
            }
        }
        return new PublishedShiftImpact(elapsed, current, future, legacy);
    }
}
