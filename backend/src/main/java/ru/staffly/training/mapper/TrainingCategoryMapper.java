package ru.staffly.training.mapper;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.TrainingCategoryDto;
import ru.staffly.training.model.TrainingCategory;
import ru.staffly.training.model.TrainingModule;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class TrainingCategoryMapper {

    private final PositionRepository positions;

    public TrainingCategoryDto toDto(TrainingCategory e) {
        if (e == null) return null;
        List<Long> ids = e.getVisibleForPositions()
                .stream().map(Position::getId).toList();

        return new TrainingCategoryDto(
                e.getId(),
                e.getRestaurant() != null ? e.getRestaurant().getId() : null,
                e.getModule(),
                e.getName(),
                e.getDescription(),
                e.getSortOrder(),
                e.isActive(),
                ids
        );
    }

    public TrainingCategory toEntity(TrainingCategoryDto dto, Restaurant restaurant, List<Long> positionIds) {
        if (dto == null) return null;
        Set<Position> pos = new LinkedHashSet<>();
        if (positionIds != null && !positionIds.isEmpty()) {
            pos = new LinkedHashSet<>(positions.findAllById(positionIds));
        }
        return TrainingCategory.builder()
                .id(dto.id())
                .restaurant(restaurant)
                .module(dto.module() != null ? dto.module() : TrainingModule.MENU)
                .name(dto.name())
                .description(dto.description())
                .sortOrder(dto.sortOrder() != null ? dto.sortOrder() : 0)
                .active(dto.active() != null ? dto.active() : true)
                .visibleForPositions(pos)
                .build();
    }

    public void updateEntity(TrainingCategory e, TrainingCategoryDto dto, Restaurant restaurant, List<Long> positionIds) {
        if (restaurant != null) e.setRestaurant(restaurant);
        if (dto.module() != null) e.setModule(dto.module());
        if (dto.name() != null) e.setName(dto.name());
        if (dto.description() != null) e.setDescription(dto.description());
        if (dto.sortOrder() != null) e.setSortOrder(dto.sortOrder());
        if (dto.active() != null) e.setActive(dto.active());
        if (positionIds != null) {
            e.setVisibleForPositions(new LinkedHashSet<>(positions.findAllById(positionIds)));
        }
    }
}