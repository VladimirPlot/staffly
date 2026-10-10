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

    ChecklistDto update(Long restaurantId, Long currentUserId, Long checklistId, ChecklistRequest request, Long expectedVersion);

    ChecklistDto reserveItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, Long expectedVersion);

    ChecklistDto unreserveItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, Long expectedVersion);

    ChecklistDto completeItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, Long expectedVersion);

    ChecklistDto undoItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, Long expectedVersion);

    ChecklistDto reset(Long restaurantId, Long currentUserId, Long checklistId, Long expectedVersion);

    void delete(Long restaurantId, Long currentUserId, Long checklistId, Long expectedVersion);

    ChecklistDto uploadExamplePhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, MultipartFile file, Long expectedVersion) throws IOException;

    ChecklistDto deleteExamplePhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, Long expectedVersion);

    ChecklistDto uploadCompletionPhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, MultipartFile file, Long expectedVersion) throws IOException;

    ChecklistDto deleteCompletionPhoto(Long restaurantId, Long currentUserId, Long checklistId, Long itemId, Long expectedVersion);

    List<ChecklistHistorySummaryDto> listHistory(Long restaurantId, Long currentUserId, Long checklistId, int page, int size);

    void processAutomaticResets(Long restaurantId);

    List<ChecklistHistorySummaryDto> listRestaurantHistory(Long restaurantId, Long currentUserId, int page, int size);

    ChecklistHistoryDetailDto getHistory(Long restaurantId, Long currentUserId, Long historyId);
}
