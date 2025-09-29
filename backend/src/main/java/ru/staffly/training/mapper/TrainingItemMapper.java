package ru.staffly.training.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.training.dto.TrainingItemDto;
import ru.staffly.training.model.TrainingCategory;
import ru.staffly.training.model.TrainingItem;

@Component
public class TrainingItemMapper {

    public TrainingItemDto toDto(TrainingItem e) {
        if (e == null) return null;
        return new TrainingItemDto(
                e.getId(),
                e.getCategory() != null ? e.getCategory().getId() : null,
                e.getName(),
                e.getDescription(),
                e.getComposition(),
                e.getAllergens(),
                e.getImageUrl(),
                e.getSortOrder(),
                e.isActive()
        );
    }

    public TrainingItem toEntity(TrainingItemDto dto, TrainingCategory category) {
        if (dto == null) return null;
        return TrainingItem.builder()
                .id(dto.id())
                .category(category)
                .name(dto.name())
                .description(dto.description())
                .composition(dto.composition())
                .allergens(dto.allergens())
                .imageUrl(dto.imageUrl())
                .sortOrder(dto.sortOrder() != null ? dto.sortOrder() : 0)
                .active(dto.active() != null ? dto.active() : true)
                .build();
    }

    public void updateEntity(TrainingItem e, TrainingItemDto dto, TrainingCategory category) {
        if (category != null) e.setCategory(category);
        if (dto.name() != null) e.setName(dto.name());
        if (dto.description() != null) e.setDescription(dto.description());
        if (dto.composition() != null) e.setComposition(dto.composition());
        if (dto.allergens() != null) e.setAllergens(dto.allergens());
        if (dto.imageUrl() != null) e.setImageUrl(dto.imageUrl());
        if (dto.sortOrder() != null) e.setSortOrder(dto.sortOrder());
        if (dto.active() != null) e.setActive(dto.active());
    }
}