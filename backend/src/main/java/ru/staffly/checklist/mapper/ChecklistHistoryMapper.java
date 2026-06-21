package ru.staffly.checklist.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.checklist.dto.ChecklistHistoryDetailDto;
import ru.staffly.checklist.dto.ChecklistHistoryItemDto;
import ru.staffly.checklist.dto.ChecklistHistorySummaryDto;
import ru.staffly.checklist.dto.ChecklistMemberShortDto;
import ru.staffly.checklist.model.ChecklistHistory;
import ru.staffly.checklist.model.ChecklistItemHistory;
import ru.staffly.media.ChecklistImageStorage;
import ru.staffly.member.model.RestaurantMember;

import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;

@Component
@RequiredArgsConstructor
public class ChecklistHistoryMapper {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    private final ChecklistImageStorage imageStorage;

    public ChecklistHistorySummaryDto toSummaryDto(ChecklistHistory entity) {
        return new ChecklistHistorySummaryDto(
                entity.getId(),
                entity.getChecklist() != null ? entity.getChecklist().getId() : null,
                entity.getChecklistName(),
                entity.getResetAt() != null ? entity.getResetAt().toString() : null,
                entity.getResetReason() != null ? entity.getResetReason().name() : null,
                entity.isCompleted(),
                entity.getTotalItems(),
                entity.getCompletedItems(),
                entity.getPositionsSnapshot()
        );
    }

    public ChecklistHistoryDetailDto toDetailDto(ChecklistHistory entity) {
        List<ChecklistHistoryItemDto> items = entity.getItems() == null
                ? List.of()
                : entity.getItems().stream()
                .sorted(Comparator.comparing(ChecklistItemHistory::getItemOrder)
                        .thenComparing(item -> item.getId() == null ? Long.MAX_VALUE : item.getId()))
                .map(this::toItemDto)
                .toList();
        return new ChecklistHistoryDetailDto(
                entity.getId(),
                entity.getChecklist() != null ? entity.getChecklist().getId() : null,
                entity.getChecklistName(),
                entity.getKind() != null ? entity.getKind().name() : null,
                entity.getPeriodicity() != null ? entity.getPeriodicity().name() : null,
                entity.getResetTime() != null ? entity.getResetTime().format(TIME_FORMATTER) : null,
                entity.getResetDayOfWeek(),
                entity.getResetDayOfMonth(),
                entity.getStartedAt() != null ? entity.getStartedAt().toString() : null,
                entity.getResetAt() != null ? entity.getResetAt().toString() : null,
                entity.getResetReason() != null ? entity.getResetReason().name() : null,
                entity.isCompleted(),
                entity.getTotalItems(),
                entity.getCompletedItems(),
                entity.getPositionsSnapshot(),
                items
        );
    }

    private ChecklistHistoryItemDto toItemDto(ChecklistItemHistory entity) {
        return new ChecklistHistoryItemDto(
                entity.getId(),
                entity.getSourceItem() != null ? entity.getSourceItem().getId() : null,
                entity.getItemOrder() != null ? entity.getItemOrder() : 0,
                entity.getText(),
                entity.isDone(),
                toMemberShort(entity.getDoneBy()),
                entity.getDoneByName(),
                entity.getDoneAt() != null ? entity.getDoneAt().toString() : null,
                toMemberShort(entity.getReservedBy()),
                entity.getReservedByName(),
                entity.getReservedAt() != null ? entity.getReservedAt().toString() : null,
                entity.isCompletionPhotoRequired(),
                entity.getExamplePhotoUrl(),
                imageStorage.toCompletionPhotoUrl(entity.getCompletionPhotoUrl())
        );
    }

    private ChecklistMemberShortDto toMemberShort(RestaurantMember member) {
        if (member == null) {
            return null;
        }
        String name = member.getUser() != null ? member.getUser().getFullName() : null;
        return new ChecklistMemberShortDto(member.getId(), name);
    }
}
