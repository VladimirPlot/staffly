package ru.staffly.checklist.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.checklist.model.Checklist;
import ru.staffly.checklist.model.ChecklistHistory;
import ru.staffly.checklist.model.ChecklistItem;
import ru.staffly.checklist.model.ChecklistItemHistory;
import ru.staffly.checklist.model.ChecklistKind;
import ru.staffly.checklist.model.ChecklistPhotoMode;
import ru.staffly.checklist.model.ChecklistResetReason;
import ru.staffly.checklist.repository.ChecklistHistoryRepository;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ChecklistHistoryService {

    private final ChecklistHistoryRepository histories;

    public void snapshotBeforeReset(Checklist checklist, Instant resetAt, ChecklistResetReason reason) {
        if (checklist == null || checklist.getKind() != ChecklistKind.TRACKABLE) {
            return;
        }

        List<ChecklistItem> sortedItems = checklist.getItems() == null
                ? List.of()
                : checklist.getItems().stream()
                .sorted(Comparator.comparing(ChecklistItem::getItemOrder)
                        .thenComparing(item -> item.getId() == null ? Long.MAX_VALUE : item.getId()))
                .toList();

        Instant effectiveResetAt = resetAt != null ? resetAt : Instant.now();
        ChecklistHistory history = ChecklistHistory.builder()
                .restaurant(checklist.getRestaurant())
                .checklist(checklist.getId() != null ? checklist : null)
                .checklistName(checklist.getName())
                .kind(checklist.getKind())
                .periodicity(checklist.getPeriodicity())
                .resetTime(checklist.getResetTime())
                .resetDayOfWeek(checklist.getResetDayOfWeek())
                .resetDayOfMonth(checklist.getResetDayOfMonth())
                .startedAt(checklist.getLastResetAt() != null ? checklist.getLastResetAt() : checklist.getCreatedAt())
                .resetAt(effectiveResetAt)
                .resetReason(reason != null ? reason : ChecklistResetReason.MANUAL)
                .completed(checklist.isCompleted())
                .totalItems(sortedItems.size())
                .completedItems((int) sortedItems.stream().filter(ChecklistItem::isDone).count())
                .positionsSnapshot(buildPositionsSnapshot(checklist))
                .build();

        for (ChecklistItem item : sortedItems) {
            ChecklistItemHistory itemHistory = ChecklistItemHistory.builder()
                    .history(history)
                    .sourceItem(item.getId() != null ? item : null)
                    .itemOrder(item.getItemOrder())
                    .text(item.getText())
                    .done(item.isDone())
                    .doneBy(item.getDoneBy())
                    .doneByName(memberName(item.getDoneBy()))
                    .doneAt(item.getDoneAt())
                    .reservedBy(item.getReservedBy())
                    .reservedByName(memberName(item.getReservedBy()))
                    .reservedAt(item.getReservedAt())
                    .completionPhotoMode(photoMode(item))
                    .completionPhotoRequired(photoMode(item) == ChecklistPhotoMode.REQUIRED)
                    .examplePhotoUrl(photoMode(item) == ChecklistPhotoMode.NONE ? null : item.getExamplePhotoUrl())
                    .completionPhotoUrl(item.getCompletionPhotoUrl())
                    .build();
            history.getItems().add(itemHistory);
        }

        histories.save(history);
    }

    public boolean isExamplePhotoReferenced(String url) {
        return url != null && !url.isBlank() && histories.existsByExamplePhotoUrl(url);
    }

    public boolean isCompletionPhotoReferenced(String url) {
        return url != null && !url.isBlank() && histories.existsByCompletionPhotoUrl(url);
    }

    private ChecklistPhotoMode photoMode(ChecklistItem item) {
        if (item.getCompletionPhotoMode() != null) {
            return item.getCompletionPhotoMode();
        }
        return item.isCompletionPhotoRequired() ? ChecklistPhotoMode.REQUIRED : ChecklistPhotoMode.NONE;
    }

    private String buildPositionsSnapshot(Checklist checklist) {
        if (checklist.getPositions() == null || checklist.getPositions().isEmpty()) {
            return null;
        }
        String snapshot = checklist.getPositions().stream()
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(Position::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(position -> position.getId() == null ? Long.MAX_VALUE : position.getId()))
                .map(position -> position.getName() == null || position.getName().isBlank()
                        ? "Должность #" + position.getId()
                        : position.getName())
                .distinct()
                .reduce((left, right) -> left + ", " + right)
                .orElse(null);
        return snapshot == null || snapshot.isBlank() ? null : snapshot;
    }

    private String memberName(RestaurantMember member) {
        if (member == null || member.getUser() == null) {
            return null;
        }
        String name = member.getUser().getFullName();
        return name == null || name.isBlank() ? null : name;
    }
}
