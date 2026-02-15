package ru.staffly.checklist.service;

import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistRequest;
import ru.staffly.checklist.model.ChecklistKind;

import java.util.List;

public interface ChecklistService {

    List<ChecklistDto> list(
            Long restaurantId,
            Long currentUserId,
            List<String> globalRoles,
            Long positionFilterId,
            ChecklistKind kind,
            String query
    );

    ChecklistDto create(Long restaurantId, Long currentUserId, ChecklistRequest request);

    ChecklistDto update(Long restaurantId, Long currentUserId, Long checklistId, ChecklistRequest request);

    ChecklistDto reserveItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId);

    ChecklistDto unreserveItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId);

    ChecklistDto completeItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId);

    ChecklistDto undoItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId);

    ChecklistDto reset(Long restaurantId, Long currentUserId, Long checklistId);

    void delete(Long restaurantId, Long currentUserId, Long checklistId);
}
