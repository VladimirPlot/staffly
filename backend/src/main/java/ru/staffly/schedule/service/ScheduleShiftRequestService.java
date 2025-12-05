package ru.staffly.schedule.service;

import ru.staffly.schedule.dto.CreateReplacementShiftRequest;
import ru.staffly.schedule.dto.CreateSwapShiftRequest;
import ru.staffly.schedule.dto.ShiftRequestDto;

import java.util.List;

public interface ScheduleShiftRequestService {

    ShiftRequestDto createReplacement(Long restaurantId, Long scheduleId, Long userId, CreateReplacementShiftRequest request);

    ShiftRequestDto createSwap(Long restaurantId, Long scheduleId, Long userId, CreateSwapShiftRequest request);

    ShiftRequestDto decideAsManager(Long restaurantId, Long requestId, Long userId, boolean accepted);

    List<ShiftRequestDto> listForSchedule(Long restaurantId, Long scheduleId, Long userId);
}