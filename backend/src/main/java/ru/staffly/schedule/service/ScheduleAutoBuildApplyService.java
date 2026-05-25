package ru.staffly.schedule.service;

import ru.staffly.schedule.dto.ApplyScheduleAutoBuildRequest;
import ru.staffly.schedule.dto.ScheduleDto;

public interface ScheduleAutoBuildApplyService {
    ScheduleDto apply(Long restaurantId, Long scheduleId, Long actorUserId, ApplyScheduleAutoBuildRequest request);
}
