package ru.staffly.schedule.service;

import ru.staffly.schedule.dto.PreviewScheduleAutoBuildRequest;
import ru.staffly.schedule.dto.ScheduleAutoBuildPreviewResponse;

public interface ScheduleAutoBuildPreviewService {
    ScheduleAutoBuildPreviewResponse preview(Long restaurantId, Long scheduleId, Long actorUserId, PreviewScheduleAutoBuildRequest request);
}
