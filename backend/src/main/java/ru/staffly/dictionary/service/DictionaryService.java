package ru.staffly.dictionary.service;

import ru.staffly.dictionary.dto.PositionDto;
import ru.staffly.dictionary.dto.ShiftDto;

import java.util.List;

public interface DictionaryService {
    PositionDto createPosition(Long restaurantId, Long currentUserId, PositionDto dto);
    List<PositionDto> listPositions(Long restaurantId, Long currentUserId, boolean includeInactive);
    PositionDto updatePosition(Long restaurantId, Long currentUserId, Long positionId, PositionDto dto);
    void deletePosition(Long restaurantId, Long currentUserId, Long positionId);

    ShiftDto createShift(Long restaurantId, Long currentUserId, ShiftDto dto);
    List<ShiftDto> listShifts(Long restaurantId, Long currentUserId);
    ShiftDto updateShift(Long restaurantId, Long currentUserId, Long shiftId, ShiftDto dto);
    void deleteShift(Long restaurantId, Long currentUserId, Long shiftId);
}