package ru.staffly.inbox.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.dictionary.model.Position;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.model.InboxRecipient;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InboxMessageService {

    private final InboxMessageRepository messages;
    private final InboxRecipientRepository recipients;

    @Transactional
    public InboxMessage createAnnouncement(Restaurant restaurant,
                                           User creator,
                                           String content,
                                           LocalDate expiresAt,
                                           List<Position> positions,
                                           List<RestaurantMember> targets) {
        String meta = ensureMeta("announcement:" + Instant.now().toEpochMilli() + ":" + creator.getId());
        InboxMessage message = InboxMessage.builder()
                .restaurant(restaurant)
                .type(InboxMessageType.ANNOUNCEMENT)
                .content(content)
                .expiresAt(expiresAt)
                .createdBy(creator)
                .meta(meta)
                .positions(new HashSet<>(positions))
                .build();

        message = messages.save(message);
        saveRecipients(message, targets);
        return message;
    }

    @Transactional
    public InboxMessage createEvent(Restaurant restaurant,
                                    User creator,
                                    String content,
                                    InboxEventSubtype subtype,
                                    String meta,
                                    List<RestaurantMember> targets,
                                    LocalDate expiresAt) {
        String resolvedMeta = meta == null || meta.isBlank()
                ? "event:" + Instant.now().toEpochMilli() + ":" + restaurant.getId()
                : meta.trim();
        InboxMessage message = InboxMessage.builder()
                .restaurant(restaurant)
                .type(InboxMessageType.EVENT)
                .eventSubtype(subtype)
                .content(content)
                .meta(ensureMeta(resolvedMeta))
                .expiresAt(expiresAt)
                .createdBy(creator)
                .build();

        message = messages.save(message);
        saveRecipients(message, targets);
        return message;
    }

    @Transactional
    public InboxMessage createBirthdayMessage(Restaurant restaurant,
                                              String content,
                                              LocalDate birthday,
                                              String meta,
                                              List<RestaurantMember> recipientsList) {
        String resolvedMeta = meta == null || meta.isBlank()
                ? "birthday:" + Instant.now().toEpochMilli()
                : meta.trim();
        InboxMessage message = InboxMessage.builder()
                .restaurant(restaurant)
                .type(InboxMessageType.BIRTHDAY)
                .content(content)
                .expiresAt(birthday)
                .meta(ensureMeta(resolvedMeta))
                .build();

        message = messages.save(message);
        if (!recipientsList.isEmpty()) {
            saveRecipients(message, recipientsList);
        }
        return message;
    }

    @Transactional
    public void ensureRecipient(InboxMessage message, RestaurantMember member) {
        if (recipients.findByMessageIdAndMemberId(message.getId(), member.getId()).isPresent()) {
            return;
        }
        recipients.save(InboxRecipient.builder()
                .message(message)
                .member(member)
                .deliveredAt(Instant.now())
                .build());
    }

    @Transactional
    public void ensureRecipientsBulk(InboxMessage message, List<RestaurantMember> targets) {
        if (targets == null || targets.isEmpty()) {
            return;
        }
        HashSet<Long> existingIds = new HashSet<>(recipients.findMemberIdsByMessageId(message.getId()));
        List<RestaurantMember> missingRecipients = targets.stream()
                .filter(member -> member.getId() != null && !existingIds.contains(member.getId()))
                .toList();
        if (missingRecipients.isEmpty()) {
            return;
        }
        saveRecipients(message, missingRecipients);
    }

    private void saveRecipients(InboxMessage message, List<RestaurantMember> targets) {
        Instant now = Instant.now();
        List<InboxRecipient> newRecipients = targets.stream()
                .map(member -> InboxRecipient.builder()
                        .message(message)
                        .member(member)
                        .deliveredAt(now)
                        .build())
                .toList();
        recipients.saveAll(newRecipients);
    }
    private String ensureMeta(String meta) {
        if (meta == null || meta.isBlank()) {
            throw new IllegalArgumentException("Inbox message meta must be provided");
        }
        return meta.trim();
    }
}