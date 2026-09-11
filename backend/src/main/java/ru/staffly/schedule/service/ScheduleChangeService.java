package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.schedule.dto.ScheduleChangeDto;
import ru.staffly.schedule.dto.ScheduleChangeItemDto;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleChangeRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleChangeService {
    private final ScheduleChangeRepository changes;
    private final RestaurantTimeService restaurantTime;

    public ScheduleChange record(Schedule schedule, Long actorUserId, String actorName,
                                 List<ScheduleChangeItem> items) {
        ScheduleChange change = ScheduleChange.builder()
                .schedule(schedule).actorUserId(actorUserId).actorDisplayName(actorName).build();
        items.forEach(item -> { item.setChange(change); change.getItems().add(item); });
        return changes.save(change);
    }

    @Transactional(readOnly = true)
    public List<ScheduleChangeDto> getHistory(Schedule schedule) {
        var today = restaurantTime.today(schedule.getRestaurant());
        return changes.findByScheduleIdOrderByCreatedAtDescIdDesc(schedule.getId()).stream()
                .map(change -> new ScheduleChangeDto(change.getId(), change.getActorUserId(),
                        change.getActorDisplayName(), change.getCreatedAt(), change.getItems().stream()
                        .map(item -> new ScheduleChangeItemDto(item.getMemberId(), item.getRowId(),
                                item.getMemberDisplayName(), item.getDay(), item.getOldValue(), item.getNewValue(),
                                item.getOldSource(), item.getNewSource(), item.getDay().isBefore(today)))
                        .toList()))
                .toList();
    }
}
