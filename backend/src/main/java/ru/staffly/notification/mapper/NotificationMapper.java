package ru.staffly.notification.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.dictionary.model.Position;
import ru.staffly.notification.dto.NotificationAuthorDto;
import ru.staffly.notification.dto.NotificationDto;
import ru.staffly.notification.dto.NotificationPositionDto;
import ru.staffly.notification.model.Notification;
import ru.staffly.user.model.User;

import java.util.Comparator;
import java.util.Locale;
import java.util.Set;

@Component
public class NotificationMapper {

    public NotificationDto toDto(Notification entity) {
        if (entity == null) return null;
        return new NotificationDto(
                entity.getId(),
                entity.getRestaurant() == null ? null : entity.getRestaurant().getId(),
                entity.getContent(),
                entity.getExpiresAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                toAuthorDto(entity.getCreator()),
                entity.getPositions().stream()
                        .sorted(Comparator.comparing(Position::getName, String.CASE_INSENSITIVE_ORDER))
                        .map(this::toPositionDto)
                        .toList()
        );
    }

    private NotificationAuthorDto toAuthorDto(User user) {
        if (user == null) return null;
        return new NotificationAuthorDto(
                user.getId(),
                displayName(user),
                user.getFirstName(),
                user.getLastName()
        );
    }

    private NotificationPositionDto toPositionDto(Position position) {
        return new NotificationPositionDto(
                position.getId(),
                position.getName(),
                position.isActive()
        );
    }

    public void applyPositions(Notification notification, Set<Position> positions) {
        if (notification.getPositions() == null) {
            notification.setPositions(positions);
            return;
        }
        notification.getPositions().clear();
        notification.getPositions().addAll(positions);
    }

    private String displayName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName().trim();
        }
        String first = user.getFirstName();
        String last = user.getLastName();
        String combined = String.format(Locale.ROOT, "%s %s",
                first == null ? "" : first,
                last == null ? "" : last).trim();
        return combined.isEmpty() ? "Сотрудник" : combined;
    }
}