package ru.staffly.inbox.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.model.InboxRecipient;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.push.service.PushEnqueueService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class InboxMessageService {

    private final InboxMessageRepository messages;
    private final InboxRecipientRepository recipients;
    private final PushEnqueueService pushEnqueueService;

    /**
     * Creates one retry-safe notification group for a business operation. This method joins the
     * caller's transaction; it deliberately does not use an independent transaction.
     */
    @Transactional
    public BusinessNotificationResult createBusinessNotification(BusinessNotificationCommand command) {
        Objects.requireNonNull(command, "command is required");
        RestaurantMember recipient = command.recipient();
        if (recipient == null) {
            return BusinessNotificationResult.suppressed(
                    BusinessNotificationResult.Status.SUPPRESSED_NO_RECIPIENT);
        }
        validateRecipient(command, recipient);

        Long recipientUserId = recipient.getUser().getId();
        if (command.actor() != null && Objects.equals(command.actor().getId(), recipientUserId)) {
            return BusinessNotificationResult.suppressed(
                    BusinessNotificationResult.Status.SUPPRESSED_ACTOR);
        }

        String meta = BusinessNotificationIdentity.meta(
                command.restaurantId(), command.operationId(), recipient.getId(), command.kind());
        // A transaction-scoped database lock closes the find-then-insert race without handling a
        // PostgreSQL constraint violation in an already-aborted JPA transaction. Because this
        // method uses REQUIRED propagation, the lock and notification share the caller's commit.
        messages.lockBusinessNotificationIdentity(meta);
        var existing = messages.findByRestaurantIdAndTypeAndMeta(
                command.restaurantId(), InboxMessageType.EVENT, meta);
        if (existing.isPresent()) {
            ensureRecipient(existing.get(), recipient);
            return BusinessNotificationResult.deduplicated(existing.get());
        }

        InboxMessage message = InboxMessage.builder()
                .restaurant(command.restaurant())
                .type(InboxMessageType.EVENT)
                .eventSubtype(command.kind().eventSubtype())
                .content(command.inboxText())
                .pushText(command.pushText())
                .meta(meta)
                .expiresAt(command.expiresAt())
                .createdBy(command.actor())
                .build();
        message = messages.save(message);
        List<RestaurantMember> savedRecipients = saveRecipients(message, List.of(recipient));
        pushEnqueueService.enqueueForMessage(message, savedRecipients);
        return BusinessNotificationResult.created(message);
    }

    @Transactional
    public InboxMessage createAnnouncement(Restaurant restaurant,
                                           User creator,
                                           String content,
                                           LocalDate expiresAt,
                                           List<Position> positions,
                                           List<RestaurantMember> targets) {
        String meta = ensureMeta("announcement:" + TimeProvider.now().toEpochMilli() + ":" + creator.getId());
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
        List<RestaurantMember> savedRecipients = saveRecipients(message, normalizeTargets(targets));
        pushEnqueueService.enqueueForMessage(message, savedRecipients);
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
                ? "event:" + TimeProvider.now().toEpochMilli() + ":" + restaurant.getId()
                : meta.trim();
        var deduplicated = messages.findByRestaurantIdAndTypeAndMeta(restaurant.getId(), InboxMessageType.EVENT, resolvedMeta);
        if (deduplicated.isPresent()) {
            ensureRecipientsBulk(deduplicated.get(), targets);
            return deduplicated.get();
        }

        InboxMessage message = InboxMessage.builder()
                .restaurant(restaurant)
                .type(InboxMessageType.EVENT)
                .eventSubtype(subtype)
                .content(content)
                .meta(ensureMeta(resolvedMeta))
                .expiresAt(expiresAt)
                .createdBy(creator)
                .build();

        try {
            message = messages.save(message);
            List<RestaurantMember> savedRecipients = saveRecipients(message, normalizeTargets(targets));
            pushEnqueueService.enqueueForMessage(message, savedRecipients);
            return message;
        } catch (DataIntegrityViolationException duplicateMetaConflict) {
            var existing = messages.findByRestaurantIdAndTypeAndMeta(restaurant.getId(), InboxMessageType.EVENT, resolvedMeta)
                    .orElseThrow(() -> duplicateMetaConflict);
            ensureRecipientsBulk(existing, targets);
            return existing;
        }
    }

    @Transactional
    public InboxMessage createBirthdayMessage(Restaurant restaurant,
                                              String content,
                                              LocalDate birthday,
                                              String meta,
                                              List<RestaurantMember> recipientsList) {
        String resolvedMeta = meta == null || meta.isBlank()
                ? "birthday:" + TimeProvider.now().toEpochMilli()
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
            List<RestaurantMember> savedRecipients = saveRecipients(message, normalizeTargets(recipientsList));
            pushEnqueueService.enqueueForMessage(message, savedRecipients);
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
                .deliveredAt(TimeProvider.now())
                .build());
        pushEnqueueService.enqueueForMessage(message, List.of(member));
    }

    @Transactional
    public void ensureRecipientsBulk(InboxMessage message, List<RestaurantMember> targets) {
        List<RestaurantMember> normalizedTargets = normalizeTargets(targets);
        if (normalizedTargets.isEmpty()) {
            return;
        }
        HashSet<Long> existingIds = new HashSet<>(recipients.findMemberIdsByMessageId(message.getId()));
        List<RestaurantMember> missingRecipients = normalizedTargets.stream()
                .filter(member -> member.getId() != null && !existingIds.contains(member.getId()))
                .toList();
        if (missingRecipients.isEmpty()) {
            return;
        }
        List<RestaurantMember> savedRecipients = saveRecipients(message, missingRecipients);
        pushEnqueueService.enqueueForMessage(message, savedRecipients);
    }

    private List<RestaurantMember> saveRecipients(InboxMessage message, List<RestaurantMember> targets) {
        if (targets == null || targets.isEmpty()) {
            return List.of();
        }
        Instant now = TimeProvider.now();
        List<InboxRecipient> newRecipients = targets.stream()
                .map(member -> InboxRecipient.builder()
                        .message(message)
                        .member(member)
                        .deliveredAt(now)
                        .build())
                .toList();
        recipients.saveAll(newRecipients);
        return targets;
    }

    private List<RestaurantMember> normalizeTargets(List<RestaurantMember> targets) {
        if (targets == null || targets.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<Long, RestaurantMember> byMemberId = new LinkedHashMap<>();
        for (RestaurantMember target : targets) {
            if (target == null || target.getId() == null) {
                continue;
            }
            byMemberId.putIfAbsent(target.getId(), target);
        }
        return List.copyOf(byMemberId.values());
    }

    private String ensureMeta(String meta) {
        if (meta == null || meta.isBlank()) {
            throw new IllegalArgumentException("Inbox message meta must be provided");
        }
        return meta.trim();
    }

    private void validateRecipient(BusinessNotificationCommand command, RestaurantMember recipient) {
        if (recipient.getId() == null || recipient.getUser() == null || recipient.getUser().getId() == null) {
            throw new IllegalArgumentException("recipient must be a persisted member with a user");
        }
        if (recipient.getRestaurant() == null
                || !Objects.equals(recipient.getRestaurant().getId(), command.restaurantId())) {
            throw new IllegalArgumentException("recipient must belong to the notification restaurant");
        }
    }
}
