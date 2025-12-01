package ru.staffly.notification.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.notification.dto.NotificationDto;
import ru.staffly.notification.dto.NotificationRequest;
import ru.staffly.notification.mapper.NotificationMapper;
import ru.staffly.notification.model.Notification;
import ru.staffly.notification.repository.NotificationRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notifications;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final RestaurantMemberRepository members;
    private final UserRepository users;
    private final NotificationMapper mapper;
    private final SecurityService security;

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<NotificationDto> list(Long restaurantId, Long currentUserId) {
        security.assertMember(currentUserId, restaurantId);

        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId).orElse(null);
        boolean canManage = security.hasAtLeastManager(currentUserId, restaurantId);
        Long myPositionId = member != null && member.getPosition() != null ? member.getPosition().getId() : null;

        LocalDate today = LocalDate.now();

        return notifications.findAllByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream()
                .filter(n -> !n.getExpiresAt().isBefore(today))
                .filter(n -> {
                    if (canManage) return true;
                    if (myPositionId == null) return false;
                    return n.getPositions().stream().anyMatch(p -> p.getId().equals(myPositionId));
                })
                .map(mapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public NotificationDto create(Long restaurantId, Long currentUserId, NotificationRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        User creator = users.findById(currentUserId)
                .orElseThrow(() -> new NotFoundException("User not found: " + currentUserId));

        String content = normalize(request.content());
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Текст уведомления обязателен");
        }

        LocalDate expiresAt = request.expiresAt();
        if (expiresAt == null) {
            throw new BadRequestException("Укажите дату окончания");
        }
        if (expiresAt.isBefore(LocalDate.now())) {
            throw new BadRequestException("Дата окончания не может быть в прошлом");
        }

        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());

        Notification notification = Notification.builder()
                .restaurant(restaurant)
                .creator(creator)
                .content(content)
                .expiresAt(expiresAt)
                .build();

        mapper.applyPositions(notification, new HashSet<>(targetPositions));
        notification = notifications.save(notification);
        return mapper.toDto(notification);
    }

    @Override
    @Transactional
    public NotificationDto update(Long restaurantId, Long currentUserId, Long notificationId, NotificationRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Notification notification = notifications.findByIdAndRestaurantId(notificationId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Notification not found: " + notificationId));

        String content = normalize(request.content());
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Текст уведомления обязателен");
        }

        LocalDate expiresAt = request.expiresAt();
        if (expiresAt == null) {
            throw new BadRequestException("Укажите дату окончания");
        }
        if (expiresAt.isBefore(LocalDate.now())) {
            throw new BadRequestException("Дата окончания не может быть в прошлом");
        }

        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());

        notification.setContent(content);
        notification.setExpiresAt(expiresAt);
        mapper.applyPositions(notification, new HashSet<>(targetPositions));

        notification = notifications.save(notification);
        return mapper.toDto(notification);
    }

    @Override
    @Transactional
    public void delete(Long restaurantId, Long currentUserId, Long notificationId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Notification notification = notifications.findByIdAndRestaurantId(notificationId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Notification not found: " + notificationId));
        notifications.delete(notification);
    }

    private List<Position> resolvePositions(Long restaurantId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            throw new BadRequestException("Нужна хотя бы одна должность");
        }
        List<Long> distinctIds = ids.stream()
                .filter(id -> id != null && id > 0)
                .distinct()
                .toList();
        if (distinctIds.isEmpty()) {
            throw new BadRequestException("Нужна хотя бы одна должность");
        }
        List<Position> found = positions.findAllById(distinctIds);
        if (found.size() != distinctIds.size()) {
            throw new BadRequestException("Некоторые должности не найдены");
        }
        for (Position position : found) {
            if (!position.getRestaurant().getId().equals(restaurantId)) {
                throw new BadRequestException("Должность принадлежит другому ресторану");
            }
        }
        return found;
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}