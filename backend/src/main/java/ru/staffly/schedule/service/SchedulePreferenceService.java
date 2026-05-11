package ru.staffly.schedule.service;

import ru.staffly.schedule.dto.SchedulePreferenceMyResponse;
import ru.staffly.schedule.dto.SchedulePreferenceProgressResponse;
import ru.staffly.schedule.dto.SchedulePreferenceSubmissionsResponse;
import ru.staffly.schedule.dto.UpsertMySchedulePreferenceRequest;

public interface SchedulePreferenceService {
    SchedulePreferenceMyResponse getMyPreference(Long restaurantId, Long scheduleId, Long userId);
    SchedulePreferenceMyResponse upsertMyPreference(Long restaurantId, Long scheduleId, Long userId, UpsertMySchedulePreferenceRequest request);
    SchedulePreferenceProgressResponse getProgress(Long restaurantId, Long scheduleId, Long actorUserId);
    SchedulePreferenceSubmissionsResponse getSubmissions(Long restaurantId, Long scheduleId, Long actorUserId);
}
