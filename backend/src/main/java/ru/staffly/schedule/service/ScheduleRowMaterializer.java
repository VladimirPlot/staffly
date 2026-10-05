package ru.staffly.schedule.service;

import org.springframework.stereotype.Component;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.model.ScheduleRow;

import java.util.Objects;
import java.util.Optional;

/** Materializes the row side of an already locked Schedule participation mutation. */
@Component
public class ScheduleRowMaterializer {

    public ScheduleRow ensureRowWithLocksHeld(Schedule schedule, RestaurantMember member,
                                                ScheduleParticipation participation) {
        return schedule.getRows().stream()
                .filter(row -> Objects.equals(row.getMemberId(), member.getId()) && !row.isHistorical())
                .findFirst()
                .orElseGet(() -> {
                    int nextSortOrder = schedule.getRows().stream()
                            .mapToInt(ScheduleRow::getSortOrder)
                            .max()
                            .orElse(-1) + 1;
                    ScheduleRow row = ScheduleRow.builder()
                            .schedule(schedule)
                            .memberId(member.getId())
                            .displayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""))
                            .positionId(participation.getPositionId())
                            .positionName(participation.getPositionName())
                            .sortOrder(nextSortOrder)
                            .build();
                    schedule.getRows().add(row);
                    return row;
                });
    }
}
