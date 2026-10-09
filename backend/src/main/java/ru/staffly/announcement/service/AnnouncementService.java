package ru.staffly.announcement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.announcement.dto.AnnouncementAuthorDto;
import ru.staffly.announcement.dto.AnnouncementDto;
import ru.staffly.announcement.dto.AnnouncementPositionDto;
import ru.staffly.announcement.dto.AnnouncementRequest;
import ru.staffly.announcement.dto.AnnouncementAudience;
import ru.staffly.announcement.dto.AnnouncementAudienceDetails;
import ru.staffly.announcement.dto.AnnouncementAudienceOptionsDto;
import ru.staffly.announcement.dto.AnnouncementMemberDto;
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
import ru.staffly.push.service.PushEnqueueService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.util.List;
import java.util.Map;
import java.util.Comparator;
import java.util.Set;
import java.util.stream.Collectors;

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
    private final PushEnqueueService pushEnqueue;
    private final ObjectMapper json;

    @Transactional(readOnly = true)
    public AnnouncementAudienceOptionsDto audienceOptions(Long restaurantId, Long userId) {
        security.assertAtLeastManager(userId, restaurantId);
        List<RestaurantMember> activeMembers = members.findActiveWithUserAndPositionByRestaurantId(restaurantId);
        Set<Long> occupiedPositions = activeMembers.stream().map(member -> member.getPosition().getId())
                .collect(Collectors.toSet());
        List<AnnouncementPositionDto> options = positions.findByRestaurantId(restaurantId).stream()
                .filter(position -> position.isActive() || occupiedPositions.contains(position.getId()))
                .sorted(Comparator.comparing(Position::getName))
                .map(this::positionDto).toList();
        return new AnnouncementAudienceOptionsDto(options, activeMembers.stream()
                .map(this::memberDto).sorted(Comparator.comparing(AnnouncementMemberDto::name)).toList());
    }

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
        // Serialize with admission, termination and position changes before resolving the audience.
        Restaurant restaurant = restaurants.findLifecycleMutex(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        security.assertAtLeastManager(userId, restaurantId);
        User creator = users.findById(userId)
                .orElseThrow(() -> new NotFoundException("User not found: " + userId));

        String content = normalize(request.content());
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Текст объявления обязателен");
        }

        List<Long> positionIds = normalizeIds(request.positionIds());
        List<Long> memberIds = normalizeIds(request.memberIds());
        validateAudience(request.audience(), positionIds, memberIds);
        List<Position> targetPositions = request.audience() == AnnouncementAudience.ALL
                ? List.of() : resolvePositions(restaurantId, positionIds);
        List<RestaurantMember> targets = resolveRecipients(restaurantId, request.audience(), positionIds, memberIds);
        if (targets.isEmpty()) {
            throw new BadRequestException("Нет действующих получателей объявления");
        }

        var details = new AnnouncementAudienceDetails(request.audience(), targets.size(),
                request.audience() == AnnouncementAudience.MEMBERS ? targets.stream().map(this::memberDto).toList() : List.of(),
                targetPositions.stream().map(this::positionDto).toList());

        InboxMessage message = inboxMessages.createAnnouncement(
                restaurant,
                creator,
                content,
                targetPositions,
                targets,
                Map.of("announcement", details)
        );
        return toDto(message);
    }

    @Transactional
    public void delete(Long restaurantId, Long userId, Long announcementId) {
        security.assertAtLeastManager(userId, restaurantId);
        InboxMessage message = messages.findByIdAndRestaurantId(announcementId, restaurantId)
                .filter(item -> item.getType() == InboxMessageType.ANNOUNCEMENT)
                .orElseThrow(() -> new NotFoundException("Announcement not found: " + announcementId));
        pushEnqueue.cancelUnsentForInboxMessage(restaurantId, announcementId);
        messages.delete(message);
    }

    private List<Position> resolvePositions(Long restaurantId, List<Long> ids) {
        List<Position> found = positions.findAllById(ids);
        if (found.size() != ids.size()) {
            throw new BadRequestException("Некоторые должности не найдены");
        }
        for (Position position : found) {
            if (!position.getRestaurant().getId().equals(restaurantId)) {
                throw new BadRequestException("Должность принадлежит другому ресторану");
            }
        }
        return found;
    }

    private List<Long> normalizeIds(List<Long> ids) {
        if (ids == null) return List.of();
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new BadRequestException("Некорректные идентификаторы получателей");
        }
        return ids.stream().distinct().toList();
    }

    private void validateAudience(AnnouncementAudience audience, List<Long> positionIds, List<Long> memberIds) {
        if (audience == null) throw new BadRequestException("Выберите получателей объявления");
        switch (audience) {
            case ALL -> {
                if (!positionIds.isEmpty() || !memberIds.isEmpty()) {
                    throw new BadRequestException("Для отправки всем не нужно выбирать должности или участников");
                }
            }
            case POSITIONS -> {
                if (positionIds.isEmpty() || !memberIds.isEmpty()) {
                    throw new BadRequestException("Выберите должности без ограничения по участникам");
                }
            }
            case MEMBERS -> {
                if (positionIds.isEmpty() || memberIds.isEmpty()) {
                    throw new BadRequestException("Выберите должности и конкретных участников");
                }
            }
        }
    }

    private List<RestaurantMember> resolveRecipients(Long restaurantId, AnnouncementAudience audience,
                                                     List<Long> positionIds, List<Long> memberIds) {
        if (audience == AnnouncementAudience.ALL) {
            return members.findActiveWithUserAndPositionByRestaurantId(restaurantId);
        }
        List<RestaurantMember> candidates = members.findActiveWithUserAndPositionByRestaurantIdAndPositionIdIn(
                restaurantId, positionIds);
        if (audience == AnnouncementAudience.POSITIONS) return candidates;
        Set<Long> selectedIds = Set.copyOf(memberIds);
        List<RestaurantMember> selected = candidates.stream().filter(member -> selectedIds.contains(member.getId())).toList();
        if (selected.size() != selectedIds.size()) {
            throw new BadRequestException("Некоторые участники больше не состоят в ресторане или не относятся к выбранным должностям. Обновите список получателей.");
        }
        return selected;
    }

    private AnnouncementPositionDto positionDto(Position position) {
        return new AnnouncementPositionDto(position.getId(), position.getName(), position.isActive(), position.getLevel());
    }

    private AnnouncementMemberDto memberDto(RestaurantMember member) {
        return new AnnouncementMemberDto(member.getId(), member.getUser().getFullName(),
                member.getPosition().getId(), member.getPosition().getName());
    }

    private AnnouncementDto toDto(InboxMessage message) {
        User creator = message.getCreatedBy();
        AnnouncementAuthorDto author = creator == null ? null : new AnnouncementAuthorDto(
                creator.getId(),
                creator.getFullName(),
                creator.getFirstName(),
                creator.getLastName()
        );
        var details = json.convertValue(message.getMetadata().get("announcement"), AnnouncementAudienceDetails.class);

        return new AnnouncementDto(
                message.getId(),
                message.getContent(),
                message.getCreatedAt(),
                author,
                details.positions(),
                details.audience(),
                details.recipientCount(),
                details.recipients()
        );
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}
