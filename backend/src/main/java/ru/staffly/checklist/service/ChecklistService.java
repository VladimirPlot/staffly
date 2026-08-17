package ru.staffly.checklist.service;

import org.springframework.web.multipart.MultipartFile;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistHistoryDetailDto;
import ru.staffly.checklist.dto.ChecklistHistorySummaryDto;
import ru.staffly.checklist.dto.ChecklistRequest;
import ru.staffly.checklist.model.ChecklistKind;

import java.io.IOException;
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

    ChecklistDto uploadExamplePhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, MultipartFile file) throws IOException;

    ChecklistDto deleteExamplePhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId);

    ChecklistDto uploadCompletionPhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, MultipartFile file) throws IOException;

    ChecklistDto deleteCompletionPhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId);

    List<ChecklistHistorySummaryDto> listHistory(Long restaurantId, Long currentUserId, Long checklistId);

    ChecklistHistoryDetailDto getHistory(Long restaurantId, Long currentUserId, Long historyId);
}
