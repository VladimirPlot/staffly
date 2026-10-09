package ru.staffly.announcement;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import ru.staffly.dictionary.model.Position;
import ru.staffly.inbox.model.*;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.push.config.PushProperties;
import ru.staffly.push.model.PushDelivery;
import ru.staffly.push.model.PushDeliveryStatus;
import ru.staffly.push.repository.PushDeliveryRepository;
import ru.staffly.push.service.PushEnqueueService;
import ru.staffly.push.service.PushPayloadFactory;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

/** Real inbox and native cleanup/cancellation queries; H2 does not test PostgreSQL row locks. */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:announcements;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class AnnouncementPersistenceTest {
    @Autowired EntityManager em;
    @Autowired InboxMessageRepository messages;
    @Autowired InboxRecipientRepository recipients;
    @Autowired PushDeliveryRepository deliveries;
    Restaurant restaurant;
    User user;
    Position position;
    RestaurantMember member;
    final Instant old = Instant.parse("2020-01-01T00:00:00Z");

    @BeforeEach void setupAudience() {
        restaurant = Restaurant.builder().name("Restaurant").code("announcement-test").timezone("UTC").build();
        em.persist(restaurant);
        user = User.builder().phone("+79999999999").email("announcement@example.com")
                .firstName("Test").lastName("Manager").passwordHash("test").build();
        em.persist(user);
        position = Position.builder().restaurant(restaurant).name("Manager").build();
        em.persist(position);
        member = RestaurantMember.builder().restaurant(restaurant).user(user).position(position).build();
        em.persist(member);
    }

    @Test void announcementCreatesOneRecipientWithoutExpiryAndKeepsReadAndHiddenStates() {
        var service = new InboxMessageService(messages, recipients, disabledPush());
        var first = service.createAnnouncement(restaurant, user, "First", List.of(position), List.of(member, member));
        var second = service.createAnnouncement(restaurant, user, "Second", List.of(position), List.of(member));
        assertNotEquals(first.getMeta(), second.getMeta());
        assertNull(first.getExpiresAt());
        assertNull(second.getExpiresAt());
        assertEquals(List.of(member.getId()), recipients.findMemberIdsByMessageId(first.getId()));
        var receipt = recipients.findByMessageIdAndMemberId(first.getId(), member.getId()).orElseThrow();
        receipt.setReadAt(old);
        receipt.setArchivedAt(old);
        first.setCreatedAt(old);
        em.flush();
        em.clear();

        assertEquals(1, recipients.findByState(member.getId(), restaurant.getId(),
                List.of(InboxMessageType.ANNOUNCEMENT), InboxState.HIDDEN,
                LocalDate.of(2030, 1, 1), PageRequest.of(0, 10)).getTotalElements());
        assertEquals(1, recipients.findByState(member.getId(), restaurant.getId(),
                List.of(InboxMessageType.ANNOUNCEMENT), InboxState.UNREAD,
                LocalDate.of(2030, 1, 1), PageRequest.of(0, 10)).getTotalElements());
        var persisted = recipients.findByMessageIdAndMemberId(first.getId(), member.getId()).orElseThrow();
        assertEquals(old, persisted.getReadAt());
        assertEquals(old, persisted.getArchivedAt());
    }

    @Test void inboxLimitPreservesEveryAnnouncementAndOnlyCountsOtherTypes() {
        var announcement = saveMessage(InboxMessageType.ANNOUNCEMENT, "old-announcement", old);
        var oldestEvent = saveMessage(InboxMessageType.EVENT, "old-event", old.plusSeconds(1));
        var newerEvent = saveMessage(InboxMessageType.EVENT, "new-event", old.plusSeconds(2));
        var newestAnnouncement = saveMessage(InboxMessageType.ANNOUNCEMENT, "new-announcement", old.plusSeconds(3));
        var newestEvent = saveMessage(InboxMessageType.EVENT, "newest-event", old.plusSeconds(4));
        var archived = recipients.findByMessageIdAndMemberId(announcement.getId(), member.getId()).orElseThrow();
        archived.setArchivedAt(old);
        em.flush();

        assertEquals(1, recipients.deleteOverflowRecipients(2));
        em.clear();

        assertTrue(recipients.findByMessageIdAndMemberId(announcement.getId(), member.getId()).isPresent());
        assertTrue(recipients.findByMessageIdAndMemberId(newestAnnouncement.getId(), member.getId()).isPresent());
        assertTrue(recipients.findByMessageIdAndMemberId(oldestEvent.getId(), member.getId()).isEmpty());
        assertTrue(recipients.findByMessageIdAndMemberId(newerEvent.getId(), member.getId()).isPresent());
        assertTrue(recipients.findByMessageIdAndMemberId(newestEvent.getId(), member.getId()).isPresent());
    }

    @Test void cancellationStopsQueuedPushEvenWhenDisabledAndPreservesSentAndUnrelatedDeliveries() {
        var pending = saveDelivery("INBOX_MESSAGE", 10L, PushDeliveryStatus.PENDING, restaurant);
        var retry = saveDelivery("INBOX_MESSAGE", 10L, PushDeliveryStatus.RETRY, restaurant);
        var sending = saveDelivery("INBOX_MESSAGE", 10L, PushDeliveryStatus.SENDING, restaurant);
        var sent = saveDelivery("INBOX_MESSAGE", 10L, PushDeliveryStatus.SENT, restaurant);
        var unrelated = saveDelivery("INBOX_MESSAGE", 20L, PushDeliveryStatus.PENDING, restaurant);
        var direct = saveDelivery("MEMBERSHIP_TERMINATED", 10L, PushDeliveryStatus.PENDING, restaurant);
        var otherRestaurant = Restaurant.builder().name("Other").code("other-restaurant").timezone("UTC").build();
        em.persist(otherRestaurant);
        var other = saveDelivery("INBOX_MESSAGE", 10L, PushDeliveryStatus.PENDING, otherRestaurant);
        em.flush();

        disabledPush().cancelUnsentForInboxMessage(restaurant.getId(), 10L);
        em.clear();

        for (var queued : List.of(pending, retry, sending)) {
            var cancelled = deliveries.findById(queued.getId()).orElseThrow();
            assertEquals(PushDeliveryStatus.DEAD, cancelled.getStatus());
            assertNull(cancelled.getNextAttemptAt());
            assertNull(cancelled.getLockedUntil());
            assertNull(cancelled.getLockOwner());
            assertEquals("Inbox message deleted", cancelled.getLastError());
        }
        assertEquals(PushDeliveryStatus.SENT, deliveries.findById(sent.getId()).orElseThrow().getStatus());
        for (var untouched : List.of(unrelated, direct, other)) {
            assertEquals(PushDeliveryStatus.PENDING, deliveries.findById(untouched.getId()).orElseThrow().getStatus());
        }
    }

    private PushEnqueueService disabledPush() {
        return new PushEnqueueService(deliveries, mock(PushPayloadFactory.class),
                new PushProperties(false, new PushProperties.Worker(false), null));
    }

    private InboxMessage saveMessage(InboxMessageType type, String meta, Instant createdAt) {
        var message = messages.save(InboxMessage.builder().restaurant(restaurant).type(type)
                .content(meta).meta(meta).createdAt(createdAt).build());
        recipients.save(InboxRecipient.builder().message(message).member(member).deliveredAt(old).build());
        return message;
    }

    private PushDelivery saveDelivery(String refType, Long refId, PushDeliveryStatus status, Restaurant targetRestaurant) {
        return deliveries.save(PushDelivery.builder().restaurant(targetRestaurant).user(user)
                .refType(refType).refId(refId).payload("{}").status(status)
                .nextAttemptAt(old).lockedUntil(old).lockOwner("worker").build());
    }
}
