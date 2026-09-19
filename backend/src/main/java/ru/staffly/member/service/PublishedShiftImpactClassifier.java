package ru.staffly.member.service;

import org.springframework.stereotype.Component;
import ru.staffly.member.dto.PositionChangeImpactPlan.PublishedShiftImpact;
import ru.staffly.schedule.model.ScheduleCell;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

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

    /** Removes only structured shifts whose physical start is strictly after now. */
    public int cancelFuture(List<ScheduleCell> cells, LocalDateTime restaurantNow) {
        int before = cells.size();
        cells.removeIf(cell -> cell.hasStructuredShift() && cell.physicalStart().isAfter(restaurantNow));
        return before - cells.size();
    }
}
