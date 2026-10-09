package ru.staffly.announcement;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.PageRequest;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.announcement.dto.AnnouncementAudience;
import ru.staffly.announcement.dto.AnnouncementRequest;
import ru.staffly.announcement.service.AnnouncementService;
import ru.staffly.announcement.repository.AnnouncementOperationRepository;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.inbox.model.*;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.push.config.PushProperties;
import ru.staffly.push.model.PushDelivery;
import ru.staffly.push.model.PushDeliveryStatus;
import ru.staffly.push.repository.PushDeliveryRepository;
import ru.staffly.push.service.PushEnqueueService;
import ru.staffly.push.service.PushPayloadFactory;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

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
    @Autowired RestaurantRepository restaurants;
    @Autowired PositionRepository positions;
    @Autowired RestaurantMemberRepository members;
    @Autowired UserRepository users;
    @Autowired AnnouncementOperationRepository operations;
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
        var first = service.createAnnouncement(restaurant, "First", List.of(position), List.of(member, member), Map.of());
        var second = service.createAnnouncement(restaurant, "Second", List.of(position), List.of(member), Map.of());
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

    @Test void audienceSnapshotSurvivesJsonReloadNameChangeAndTermination() {
        var service = announcementService();
        var sent = service.create(restaurant.getId(), user.getId(), new AnnouncementRequest("Message",
                AnnouncementAudience.MEMBERS, List.of(position.getId()), List.of(member.getId()), java.util.UUID.randomUUID()));
        assertEquals(1, sent.recipientCount());
        user.setFirstName("Renamed");
        member.setEndedAt(Instant.now());
        em.flush();
        em.clear();

        var history = service.list(restaurant.getId(), user.getId(), 0).items();
        assertEquals(1, history.size());
        assertEquals("Test Manager", history.get(0).recipients().get(0).name());
        assertEquals("Manager", history.get(0).recipients().get(0).positionName());
        assertEquals(1, history.get(0).recipientCount());
        assertEquals("Test Manager", history.get(0).createdBy().name());
        assertNull(messages.findById(sent.id()).orElseThrow().getCreatedBy());
        assertEquals(List.of(member.getId()), recipients.findMemberIdsByMessageId(sent.id()));
    }

    @Test void actualQueriesExcludeEndedAndForeignMembershipsAndRejectChangedPositions() {
        var otherRestaurant = Restaurant.builder().name("Other").code("audience-other").timezone("UTC").build();
        em.persist(otherRestaurant);
        var otherPosition = Position.builder().restaurant(otherRestaurant).name("Other").build();
        em.persist(otherPosition);
        var foreign = RestaurantMember.builder().restaurant(otherRestaurant).user(user).position(otherPosition).build();
        em.persist(foreign);
        var endedUser = User.builder().phone("+79999999998").email("ended@example.com")
                .firstName("Ended").lastName("Employee").passwordHash("test").build();
        em.persist(endedUser);
        var ended = RestaurantMember.builder().restaurant(restaurant).user(endedUser).position(position)
                .endedAt(Instant.now()).build();
        em.persist(ended);
        em.flush();

        var service = announcementService();
        var all = service.create(restaurant.getId(), user.getId(), new AnnouncementRequest("Everyone",
                AnnouncementAudience.ALL, List.of(), List.of(), java.util.UUID.randomUUID()));
        assertEquals(List.of(member.getId()), recipients.findMemberIdsByMessageId(all.id()));
        assertEquals(1, service.audienceOptions(restaurant.getId(), user.getId()).members().size());
        for (var invalid : List.of(foreign.getId(), ended.getId())) {
            assertThrows(BadRequestException.class, () -> service.create(restaurant.getId(), user.getId(),
                    new AnnouncementRequest("Specific", AnnouncementAudience.MEMBERS,
                            List.of(position.getId()), List.of(invalid), java.util.UUID.randomUUID())));
        }
        var newPosition = Position.builder().restaurant(restaurant).name("New position").build();
        em.persist(newPosition);
        member.setPosition(newPosition);
        em.flush();
        assertThrows(BadRequestException.class, () -> service.create(restaurant.getId(), user.getId(),
                new AnnouncementRequest("Stale selection", AnnouncementAudience.MEMBERS,
                        List.of(position.getId()), List.of(member.getId()), java.util.UUID.randomUUID())));
        assertEquals(1, messages.findByRestaurantIdAndTypeOrderByCreatedAtDesc(
                restaurant.getId(), InboxMessageType.ANNOUNCEMENT).size());
    }

    private AnnouncementService announcementService() {
        return new AnnouncementService(messages, new InboxMessageService(messages, recipients, disabledPush()),
                restaurants, positions, members, users, mock(SecurityService.class), disabledPush(), new ObjectMapper(), operations);
    }

    @Test void retryReturnsTheOriginalSendEvenAfterRosterChangesAndRejectsKeyReuse() {
        var service = announcementService();
        var operationId = java.util.UUID.randomUUID();
        var request = new AnnouncementRequest("  Message  ", AnnouncementAudience.MEMBERS,
                List.of(position.getId(), position.getId()), List.of(member.getId()), operationId);
        var sent = service.create(restaurant.getId(), user.getId(), request);
        member.setEndedAt(Instant.now());
        user.setFirstName("Changed");
        em.flush();
        em.clear();

        var replay = service.create(restaurant.getId(), user.getId(), new AnnouncementRequest("Message",
                AnnouncementAudience.MEMBERS, List.of(position.getId()), List.of(member.getId()), operationId));
        assertEquals(sent.id(), replay.id());
        assertEquals("Test Manager", replay.createdBy().name());
        assertEquals(1, messages.count());
        assertEquals(1, recipients.count());
        assertEquals(1, operations.count());
        assertThrows(BadRequestException.class, () -> service.create(restaurant.getId(), user.getId(),
                new AnnouncementRequest("Different", AnnouncementAudience.MEMBERS,
                        List.of(position.getId()), List.of(member.getId()), operationId)));

        service.delete(restaurant.getId(), user.getId(), sent.id());
        em.flush();
        em.clear();
        assertThrows(BadRequestException.class, () -> service.create(restaurant.getId(), user.getId(), request));
        assertEquals(0, messages.count());
        assertEquals(1, operations.count());
        assertNull(operations.findAll().get(0).getMessageId());
    }

    @Test void historyPagesHaveThirtyItemsAndStableOrderingIncludingTheLastPage() {
        var service = announcementService();
        for (int i = 0; i < 61; i++) {
            var sent = service.create(restaurant.getId(), user.getId(), new AnnouncementRequest("Message",
                    AnnouncementAudience.ALL, List.of(), List.of(), java.util.UUID.randomUUID()));
            messages.findById(sent.id()).orElseThrow().setCreatedAt(old);
        }
        em.flush();
        em.clear();
        var firstPage = service.list(restaurant.getId(), user.getId(), 0);
        var secondPage = service.list(restaurant.getId(), user.getId(), 1);
        var lastPage = service.list(restaurant.getId(), user.getId(), 2);
        assertEquals(30, firstPage.items().size());
        assertEquals(30, secondPage.items().size());
        assertEquals(1, lastPage.items().size());
        assertEquals(61, firstPage.totalElements());
        assertEquals(3, firstPage.totalPages());
        assertEquals(30, firstPage.size());
        assertTrue(firstPage.items().get(29).id() > secondPage.items().get(0).id());
        assertTrue(secondPage.items().get(29).id() > lastPage.items().get(0).id());
        assertTrue(service.list(restaurant.getId(), user.getId(), 3).items().isEmpty());
        assertThrows(BadRequestException.class, () -> service.list(restaurant.getId(), user.getId(), -1));
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
