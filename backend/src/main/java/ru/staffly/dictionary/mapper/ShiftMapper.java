package ru.staffly.dictionary.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.dictionary.dto.ShiftDto;
import ru.staffly.dictionary.model.Shift;
import ru.staffly.restaurant.model.Restaurant;

@Component
public class ShiftMapper {

    public ShiftDto toDto(Shift e) {
        if (e == null) return null;
        return new ShiftDto(
                e.getId(),
                e.getRestaurant() != null ? e.getRestaurant().getId() : null,
                e.getName(),
                e.getStartTime(),
                e.getEndTime(),
                e.isActive()
        );
    }

    public Shift toEntity(ShiftDto dto, Restaurant restaurant) {
        if (dto == null) return null;
        return Shift.builder()
                .id(dto.id())
                .restaurant(restaurant)
                .name(dto.name())
                .startTime(dto.startTime())
                .endTime(dto.endTime())
                .active(dto.active())
                .build();
    }

    public void updateEntity(Shift e, ShiftDto dto, Restaurant restaurant) {
        if (dto.name() != null) e.setName(dto.name());
        if (dto.startTime() != null) e.setStartTime(dto.startTime());
        if (dto.endTime() != null) e.setEndTime(dto.endTime());
        if (restaurant != null) e.setRestaurant(restaurant);
        e.setActive(dto.active());
    }
}