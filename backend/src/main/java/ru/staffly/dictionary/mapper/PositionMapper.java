package ru.staffly.dictionary.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.dictionary.dto.PositionDto;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;

@Component
public class PositionMapper {

    public PositionDto toDto(Position e) {
        if (e == null) return null;
        return new PositionDto(
                e.getId(),
                e.getRestaurant() != null ? e.getRestaurant().getId() : null,
                e.getName(),
                e.isActive()
        );
    }

    public Position toEntity(PositionDto dto, Restaurant restaurant) {
        if (dto == null) return null;
        return Position.builder()
                .id(dto.id())
                .restaurant(restaurant)
                .name(dto.name())
                .active(dto.active())
                .build();
    }

    public void updateEntity(Position e, PositionDto dto, Restaurant restaurant) {
        if (dto.name() != null) e.setName(dto.name());
        if (restaurant != null) e.setRestaurant(restaurant);
        e.setActive(dto.active());
    }
}