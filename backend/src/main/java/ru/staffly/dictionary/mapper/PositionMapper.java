package ru.staffly.dictionary.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.dictionary.dto.PositionDto;
import ru.staffly.dictionary.model.Position;
import ru.staffly.master_schedule.model.PayType;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;

@Component
public class PositionMapper {

    public PositionDto toDto(Position e) {
        if (e == null) return null;
        return new PositionDto(
                e.getId(),
                e.getRestaurant() != null ? e.getRestaurant().getId() : null,
                e.getName(),
                e.isActive(),
                e.getLevel(),
                e.getPayType(),
                e.getPayRate(),
                e.getNormHours()
        );
    }

    public Position toEntity(PositionDto dto, Restaurant restaurant) {
        if (dto == null) return null;
        return Position.builder()
                .id(dto.id())
                .restaurant(restaurant)
                .name(dto.name())
                .active(dto.active())
                .level(dto.level() != null ? dto.level() : RestaurantRole.STAFF)
                .payType(dto.payType() != null ? dto.payType() : PayType.HOURLY)
                .payRate(dto.payRate())
                .normHours(dto.normHours())
                .build();
    }

    public void updateEntity(Position e, PositionDto dto, Restaurant restaurant) {
        if (dto.name() != null) e.setName(dto.name());
        if (restaurant != null) e.setRestaurant(restaurant);
        if (dto.active() != null) e.setActive(dto.active());
        if (dto.level() != null) e.setLevel(dto.level());
        if (dto.payType() != null) e.setPayType(dto.payType());
        if (dto.payRate() != null || dto.payRate() == null) e.setPayRate(dto.payRate());
        if (dto.normHours() != null || dto.normHours() == null) e.setNormHours(dto.normHours());
    }
}