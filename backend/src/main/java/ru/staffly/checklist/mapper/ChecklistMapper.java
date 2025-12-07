package ru.staffly.checklist.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistItemDto;
import ru.staffly.checklist.dto.ChecklistPositionDto;
import ru.staffly.checklist.model.Checklist;
import ru.staffly.checklist.model.ChecklistItem;
import ru.staffly.checklist.model.ChecklistKind;
import ru.staffly.checklist.model.ChecklistPeriodicity;
import ru.staffly.dictionary.model.Position;

import java.time.DayOfWeek;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Component
public class ChecklistMapper {

    public ChecklistDto toDto(Checklist entity) {
        List<ChecklistPositionDto> positions = entity.getPositions() == null
                ? List.of()
                : entity.getPositions().stream()
                .sorted(Comparator.comparing(Position::getName, String.CASE_INSENSITIVE_ORDER))
                .map(pos -> new ChecklistPositionDto(pos.getId(), pos.getName()))
                .toList();
        List<ChecklistItemDto> items = entity.getItems() == null
                ? List.of()
                : entity.getItems().stream()
                .sorted(Comparator.comparing(ChecklistItem::getItemOrder))
                .map(item -> new ChecklistItemDto(item.getId(), item.getText(), item.isDone()))
                .toList();
        return new ChecklistDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getName(),
                entity.getContent(),
                entity.getKind() != null ? entity.getKind().name() : ChecklistKind.INFO.name(),
                entity.getPeriodicity() != null ? entity.getPeriodicity().name() : null,
                entity.isCompleted(),
                buildPeriodLabel(entity),
                entity.getResetTime() != null ? entity.getResetTime().format(DateTimeFormatter.ofPattern("HH:mm")) : null,
                entity.getResetDayOfWeek(),
                entity.getResetDayOfMonth(),
                items,
                positions
        );
    }

    public void applyPositions(Checklist entity, Set<Position> positions) {
        entity.getPositions().clear();
        entity.getPositions().addAll(positions);
    }

    private String buildPeriodLabel(Checklist entity) {
        ChecklistPeriodicity periodicity = entity.getPeriodicity();
        if (entity.getKind() != ChecklistKind.TRACKABLE || periodicity == null) {
            return null;
        }
        String timeLabel = entity.getResetTime() != null ? entity.getResetTime().format(DateTimeFormatter.ofPattern("HH:mm")) : null;
        return switch (periodicity) {
            case DAILY -> timeLabel != null ? "Каждый день в " + timeLabel : "Каждый день";
            case WEEKLY -> {
                if (entity.getResetDayOfWeek() == null) {
                    yield null;
                }
                DayOfWeek day = DayOfWeek.of(Math.max(1, Math.min(7, entity.getResetDayOfWeek())));
                String dayLabel = day.getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.forLanguageTag("ru"));
                yield timeLabel != null ? "Каждый " + dayLabel + " в " + timeLabel : "Каждый " + dayLabel;
            }
            case MONTHLY -> {
                Integer dayOfMonth = entity.getResetDayOfMonth();
                if (dayOfMonth == null) {
                    yield null;
                }
                String base = "Раз в месяц, " + dayOfMonth + " числа";
                yield timeLabel != null ? base + " в " + timeLabel : base;
            }
            case MANUAL -> "Сбрасывается вручную";
        };
    }
}