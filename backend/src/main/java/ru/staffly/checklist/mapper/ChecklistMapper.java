package ru.staffly.checklist.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistPositionDto;
import ru.staffly.checklist.model.Checklist;
import ru.staffly.dictionary.model.Position;

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
        return new ChecklistDto(
                entity.getId(),
                entity.getRestaurant().getId(),
                entity.getName(),
                entity.getContent(),
                positions
        );
    }

    public void applyPositions(Checklist entity, Set<Position> positions) {
        entity.getPositions().clear();
        entity.getPositions().addAll(positions);
    }
}