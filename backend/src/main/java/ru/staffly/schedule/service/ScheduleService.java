package ru.staffly.schedule.service;

import ru.staffly.schedule.dto.SaveScheduleRequest;
import ru.staffly.schedule.dto.AddableScheduleMemberDto;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.schedule.dto.ScheduleSummaryDto;
import ru.staffly.schedule.dto.StartPreferenceCollectionRequest;

import java.util.List;

public interface ScheduleService {

    ScheduleDto create(Long restaurantId, Long userId, SaveScheduleRequest request);

    ScheduleDto createDraft(Long restaurantId, Long userId, SaveScheduleRequest request);

    List<ScheduleSummaryDto> list(Long restaurantId, Long userId);

    ScheduleDto get(Long restaurantId, Long scheduleId, Long userId);

    ScheduleDto update(Long restaurantId, Long scheduleId, Long userId, SaveScheduleRequest request);

    List<AddableScheduleMemberDto> getAddableMembers(Long restaurantId, Long scheduleId, Long userId);

    ScheduleDto addMember(Long restaurantId, Long scheduleId, Long userId, Long memberId);

    ScheduleDto startPreferenceCollection(Long restaurantId, Long scheduleId, Long actorUserId, StartPreferenceCollectionRequest request);

    ScheduleDto closePreferenceCollection(Long restaurantId, Long scheduleId, Long actorUserId);

    ScheduleDto applyPreferencesSimple(Long restaurantId, Long scheduleId, Long actorUserId);

    ScheduleDto publish(Long restaurantId, Long scheduleId, Long actorUserId);

    void delete(Long restaurantId, Long scheduleId, Long userId);
}
