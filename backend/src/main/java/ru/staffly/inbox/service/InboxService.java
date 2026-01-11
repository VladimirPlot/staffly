package ru.staffly.inbox.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.inbox.dto.InboxAuthorDto;
import ru.staffly.inbox.dto.InboxMarkerDto;
import ru.staffly.inbox.dto.InboxMessageDto;
import ru.staffly.inbox.dto.InboxPageDto;
import ru.staffly.inbox.dto.InboxUnreadCountDto;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.model.InboxRecipient;
import ru.staffly.inbox.model.InboxState;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InboxService {

    public enum InboxTypeFilter {
        ALL,
        BIRTHDAY,
        EVENT,
        ANNOUNCEMENT
    }

    private final InboxRecipientRepository recipients;
    private final RestaurantMemberRepository members;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;

    @Transactional(readOnly = true)
    public InboxPageDto list(Long restaurantId,
                             Long userId,
                             InboxTypeFilter typeFilter,
                             InboxState state,
                             int page,
                             int size) {
        security.assertMember(userId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        LocalDate today = restaurantTime.today(restaurantId);
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.max(1, size));
        List<InboxMessageType> types = resolveTypes(typeFilter);

        Page<InboxRecipient> inboxPage = recipients.findByState(
                member.getId(),
                restaurantId,
                types,
                state,
                today,
                pageable
        );

        Page<InboxMessageDto> mapped = inboxPage.map(recipient -> toDto(recipient, today));

        return new InboxPageDto(
                mapped.getContent(),
                mapped.getNumber(),
                mapped.getSize(),
                mapped.getTotalElements(),
                mapped.getTotalPages(),
                mapped.hasNext()
        );
    }

    @Transactional(readOnly = true)
    public InboxUnreadCountDto unreadCount(Long restaurantId, Long userId) {
        security.assertMember(userId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        LocalDate today = restaurantTime.today(restaurantId);
        long total = recipients.countUnread(member.getId(), restaurantId, today);
        long events = recipients.countUnreadByType(member.getId(), restaurantId, InboxMessageType.EVENT, today);
        long scheduleEvents = recipients.countUnreadEventsBySubtypes(
                member.getId(),
                restaurantId,
                List.of(InboxEventSubtype.SCHEDULE_DECISION),
                today
        );

        return new InboxUnreadCountDto(total, events, scheduleEvents);
    }

    @Transactional(readOnly = true)
    public InboxMarkerDto markers(Long restaurantId, Long userId) {
        security.assertMember(userId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        LocalDate today = restaurantTime.today(restaurantId);
        boolean hasScheduleEvents = recipients.countUnreadEventsBySubtypes(
                member.getId(),
                restaurantId,
                List.of(InboxEventSubtype.SCHEDULE_DECISION),
                today
        ) > 0;

        return new InboxMarkerDto(hasScheduleEvents);
    }

    @Transactional
    public void markRead(Long restaurantId, Long userId, Long messageId) {
        security.assertMember(userId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        InboxRecipient recipient = recipients.findByMessageIdAndMemberId(messageId, member.getId()).orElse(null);
        if (recipient == null) {
            return;
        }
        if (recipient.getReadAt() == null) {
            recipient.setReadAt(TimeProvider.now());
            recipients.save(recipient);
        }
    }

    @Transactional
    public void hide(Long restaurantId, Long userId, Long messageId) {
        security.assertMember(userId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        InboxRecipient recipient = recipients.findByMessageIdAndMemberId(messageId, member.getId()).orElse(null);
        if (recipient == null) {
            return;
        }
        if (recipient.getArchivedAt() == null) {
            recipient.setArchivedAt(TimeProvider.now());
            recipients.save(recipient);
        }
    }

    @Transactional
    public void restore(Long restaurantId, Long userId, Long messageId) {
        security.assertMember(userId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        InboxRecipient recipient = recipients.findByMessageIdAndMemberId(messageId, member.getId()).orElse(null);
        if (recipient == null) {
            return;
        }
        if (recipient.getArchivedAt() != null) {
            recipient.setArchivedAt(null);
            recipients.save(recipient);
        }
    }

    private InboxMessageDto toDto(InboxRecipient recipient, LocalDate today) {
        InboxMessage message = recipient.getMessage();
        User creator = message.getCreatedBy();
        InboxAuthorDto author = creator == null ? null : new InboxAuthorDto(
                creator.getId(),
                creator.getFullName(),
                creator.getFirstName(),
                creator.getLastName()
        );

        boolean expired = message.getExpiresAt() != null && message.getExpiresAt().isBefore(today);

        return new InboxMessageDto(
                message.getId(),
                message.getType(),
                message.getEventSubtype(),
                message.getContent(),
                message.getExpiresAt(),
                message.getCreatedAt(),
                author,
                recipient.getReadAt() != null,
                recipient.getArchivedAt() != null,
                expired
        );
    }

    private List<InboxMessageType> resolveTypes(InboxTypeFilter typeFilter) {
        if (typeFilter == null || typeFilter == InboxTypeFilter.ALL) {
            return List.of(InboxMessageType.BIRTHDAY, InboxMessageType.EVENT, InboxMessageType.ANNOUNCEMENT);
        }
        return List.of(switch (typeFilter) {
            case BIRTHDAY -> InboxMessageType.BIRTHDAY;
            case EVENT -> InboxMessageType.EVENT;
            case ANNOUNCEMENT -> InboxMessageType.ANNOUNCEMENT;
            case ALL -> throw new IllegalStateException("Unexpected value: " + typeFilter);
        });
    }

}