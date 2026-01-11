package ru.staffly.announcement.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.announcement.dto.AnnouncementAuthorDto;
import ru.staffly.announcement.dto.AnnouncementDto;
import ru.staffly.announcement.dto.AnnouncementPositionDto;
import ru.staffly.announcement.dto.AnnouncementRequest;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final InboxMessageRepository messages;
    private final InboxMessageService inboxMessages;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final RestaurantMemberRepository members;
    private final UserRepository users;
    private final SecurityService security;

    @Transactional(readOnly = true)
    public List<AnnouncementDto> list(Long restaurantId, Long userId) {
        security.assertAtLeastManager(userId, restaurantId);
        return messages.findByRestaurantIdAndTypeOrderByCreatedAtDesc(restaurantId, InboxMessageType.ANNOUNCEMENT)
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public AnnouncementDto create(Long restaurantId, Long userId, AnnouncementRequest request) {
        security.assertAtLeastManager(userId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        User creator = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        String content = normalize(request.content());
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Текст объявления обязателен");
        }

        LocalDate today = LocalDate.now();
        LocalDate expiresAt = request.expiresAt();
        if (expiresAt != null && expiresAt.isBefore(today)) {
            throw new BadRequestException("Дата окончания не может быть в прошлом");
        }

        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());
        List<RestaurantMember> targets = resolveRecipients(restaurantId, targetPositions);

        InboxMessage message = inboxMessages.createAnnouncement(
                restaurant,
                creator,
                content,
                expiresAt,
                targetPositions,
                targets
        );
        return toDto(message);
    }

    @Transactional
    public AnnouncementDto update(Long restaurantId, Long userId, Long announcementId, AnnouncementRequest request) {
        security.assertAtLeastManager(userId, restaurantId);
        InboxMessage existing = messages.findByIdAndRestaurantId(announcementId, restaurantId)
                .filter(message -> message.getType() == InboxMessageType.ANNOUNCEMENT)
                .orElseThrow(() -> new NotFoundException("Announcement not found: " + announcementId));

        String content = normalize(request.content());
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Текст объявления обязателен");
        }

        LocalDate today = LocalDate.now();
        LocalDate expiresAt = request.expiresAt();
        if (expiresAt != null && expiresAt.isBefore(today)) {
            throw new BadRequestException("Дата окончания не может быть в прошлом");
        }

        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());
        List<RestaurantMember> targets = resolveRecipients(restaurantId, targetPositions);
        Restaurant restaurant = existing.getRestaurant();
        User creator = existing.getCreatedBy();

        existing.setExpiresAt(today.minusDays(1));
        messages.save(existing);

        InboxMessage message = inboxMessages.createAnnouncement(
                restaurant,
                creator,
                content,
                expiresAt,
                targetPositions,
                targets
        );

        return toDto(message);
    }

    @Transactional
    public void delete(Long restaurantId, Long userId, Long announcementId) {
        security.assertAtLeastManager(userId, restaurantId);
        InboxMessage message = messages.findByIdAndRestaurantId(announcementId, restaurantId)
                .filter(item -> item.getType() == InboxMessageType.ANNOUNCEMENT)
                .orElseThrow(() -> new NotFoundException("Announcement not found: " + announcementId));
        messages.delete(message);
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

    private List<RestaurantMember> resolveRecipients(Long restaurantId, List<Position> targetPositions) {
        List<Long> positionIds = targetPositions.stream().map(Position::getId).toList();
        if (positionIds.isEmpty()) {
            return List.of();
        }
        return members.findByRestaurantIdAndPositionIdIn(restaurantId, positionIds);
    }

    private AnnouncementDto toDto(InboxMessage message) {
        User creator = message.getCreatedBy();
        AnnouncementAuthorDto author = creator == null ? null : new AnnouncementAuthorDto(
                creator.getId(),
                creator.getFullName(),
                creator.getFirstName(),
                creator.getLastName()
        );
        List<AnnouncementPositionDto> positions = message.getPositions().stream()
                .map(position -> new AnnouncementPositionDto(
                        position.getId(),
                        position.getName(),
                        position.isActive(),
                        position.getLevel()
                ))
                .toList();

        return new AnnouncementDto(
                message.getId(),
                message.getContent(),
                message.getExpiresAt(),
                message.getCreatedAt(),
                message.getUpdatedAt(),
                author,
                positions
        );
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}