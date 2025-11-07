package ru.staffly.schedule.service;

import ru.staffly.schedule.dto.SaveScheduleRequest;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.schedule.dto.ScheduleSummaryDto;

import java.util.List;

public interface ScheduleService {

    ScheduleDto create(Long restaurantId, Long userId, SaveScheduleRequest request);

    List<ScheduleSummaryDto> list(Long restaurantId, Long userId);

    ScheduleDto get(Long restaurantId, Long scheduleId, Long userId);

    ScheduleDto update(Long restaurantId, Long scheduleId, Long userId, SaveScheduleRequest request);

    void delete(Long restaurantId, Long scheduleId, Long userId);
}