package ru.staffly.checklist.service;

import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistRequest;

import java.util.List;

public interface ChecklistService {

    List<ChecklistDto> list(Long restaurantId, Long currentUserId, List<String> globalRoles, Long positionFilterId);

    ChecklistDto create(Long restaurantId, Long currentUserId, ChecklistRequest request);

    ChecklistDto update(Long restaurantId, Long currentUserId, Long checklistId, ChecklistRequest request);

    ChecklistDto updateProgress(Long restaurantId, Long currentUserId, Long checklistId, List<Long> itemIds);

    ChecklistDto reset(Long restaurantId, Long currentUserId, Long checklistId);

    void delete(Long restaurantId, Long currentUserId, Long checklistId);
}