package ru.staffly.inbox.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.model.InboxRecipient;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.push.service.PushEnqueueService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.lang.reflect.Method;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InboxMessageServiceBusinessNotificationTest {
    private static final UUID OPERATION_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

    @Mock InboxMessageRepository messages;
    @Mock InboxRecipientRepository recipients;
    @Mock PushEnqueueService pushEnqueueService;

    private InboxMessageService service;
    private Restaurant restaurant;
    private RestaurantMember recipient;

    @BeforeEach
    void setUp() {
        service = new InboxMessageService(messages, recipients, pushEnqueueService);
        restaurant = Restaurant.builder().id(7L).build();
        recipient = member(11L, 101L);
    }

    @Test
    void suppressesActorBeforeCreatingAnyDurableNotificationState() {
        var result = service.createBusinessNotification(command(
                OPERATION_ID, recipient, recipient.getUser(), BusinessNotificationKind.SCHEDULE));

        assertThat(result.status()).isEqualTo(BusinessNotificationResult.Status.SUPPRESSED_ACTOR);
        assertThat(result.message()).isNull();
        verifyNoInteractions(messages, recipients, pushEnqueueService);
    }

    @Test
    void suppressesMissingRecipientWithoutChoosingFallback() {
        var result = service.createBusinessNotification(command(
                OPERATION_ID, null, User.builder().id(999L).build(), BusinessNotificationKind.SCHEDULE));

        assertThat(result.status()).isEqualTo(BusinessNotificationResult.Status.SUPPRESSED_NO_RECIPIENT);
        verifyNoInteractions(messages, recipients, pushEnqueueService);
    }

    @Test
    void identicalGroupedIdentityCreatesOneDurableEvent() {
        AtomicReference<InboxMessage> stored = new AtomicReference<>();
        String identity = BusinessNotificationIdentity.meta(
                7L, OPERATION_ID, 11L, BusinessNotificationKind.SCHEDULE);
        when(messages.findByRestaurantIdAndTypeAndMeta(7L, InboxMessageType.EVENT,
                identity))
                .thenAnswer(ignored -> Optional.ofNullable(stored.get()));
        when(messages.save(any())).thenAnswer(invocation -> {
            InboxMessage message = invocation.getArgument(0);
            message.setId(90L);
            stored.set(message);
            return message;
        });
        when(recipients.findByMessageIdAndMemberId(90L, 11L))
                .thenReturn(Optional.of(InboxRecipient.builder().id(91L).build()));

        var first = service.createBusinessNotification(command(
                OPERATION_ID, recipient, User.builder().id(999L).build(), BusinessNotificationKind.SCHEDULE));
        var second = service.createBusinessNotification(command(
                OPERATION_ID, recipient, User.builder().id(999L).build(), BusinessNotificationKind.SCHEDULE));

        assertThat(first.status()).isEqualTo(BusinessNotificationResult.Status.CREATED);
        assertThat(second.status()).isEqualTo(BusinessNotificationResult.Status.DEDUPLICATED);
        assertThat(second.message()).isSameAs(first.message());
        verify(messages, times(2)).lockBusinessNotificationIdentity(identity);
        verify(messages).save(any());
        verify(recipients).saveAll(any());
        verify(pushEnqueueService).enqueueForMessage(any(), any());
    }

    @Test
    void identitySeparatesRecipientKindAndOperation() {
        String baseline = BusinessNotificationIdentity.meta(
                7L, OPERATION_ID, 11L, BusinessNotificationKind.SCHEDULE);

        assertThat(BusinessNotificationIdentity.meta(
                7L, OPERATION_ID, 12L, BusinessNotificationKind.SCHEDULE)).isNotEqualTo(baseline);
        assertThat(BusinessNotificationIdentity.meta(
                7L, OPERATION_ID, 11L, BusinessNotificationKind.CERTIFICATION)).isNotEqualTo(baseline);
        assertThat(BusinessNotificationIdentity.meta(
                7L, UUID.fromString("10000000-0000-0000-0000-000000000002"),
                11L, BusinessNotificationKind.SCHEDULE)).isNotEqualTo(baseline);
    }

    @Test
    void createsIndependentEventsForDifferentRecipientsKindsAndOperations() {
        AtomicLong ids = new AtomicLong(1L);
        when(messages.findByRestaurantIdAndTypeAndMeta(anyLong(), any(), anyString()))
                .thenReturn(Optional.empty());
        when(messages.save(any())).thenAnswer(invocation -> {
            InboxMessage message = invocation.getArgument(0);
            message.setId(ids.getAndIncrement());
            return message;
        });

        RestaurantMember otherRecipient = member(12L, 102L);
        User actor = User.builder().id(999L).build();
        service.createBusinessNotification(command(OPERATION_ID, recipient, actor, BusinessNotificationKind.SCHEDULE));
        service.createBusinessNotification(command(OPERATION_ID, otherRecipient, actor, BusinessNotificationKind.SCHEDULE));
        service.createBusinessNotification(command(OPERATION_ID, recipient, actor, BusinessNotificationKind.CERTIFICATION));
        service.createBusinessNotification(command(
                UUID.fromString("10000000-0000-0000-0000-000000000002"),
                recipient, actor, BusinessNotificationKind.SCHEDULE));

        verify(messages, times(4)).save(any(InboxMessage.class));
        verify(messages, times(4)).lockBusinessNotificationIdentity(anyString());
        verify(recipients, times(4)).saveAll(any());
        verify(pushEnqueueService, times(4)).enqueueForMessage(any(), any());
    }

    @Test
    void storesDetailedInboxTextAndOptionalPushText() {
        when(messages.findByRestaurantIdAndTypeAndMeta(anyLong(), any(), anyString()))
                .thenReturn(Optional.empty());
        when(messages.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.createBusinessNotification(new BusinessNotificationCommand(
                restaurant, OPERATION_ID, recipient, User.builder().id(999L).build(),
                BusinessNotificationKind.CERTIFICATION, "Detailed inbox text", "Short push text",
                java.util.Map.of("resourceIds", java.util.List.of(21L)), null));

        assertThat(result.message().getContent()).isEqualTo("Detailed inbox text");
        assertThat(result.message().getPushText()).isEqualTo("Short push text");
        assertThat(result.message().getMetadata()).containsEntry("resourceIds", java.util.List.of(21L));
    }

    @Test
    void fallsBackToPushTextWhenInboxTextIsAbsent() {
        var command = new BusinessNotificationCommand(
                restaurant, OPERATION_ID, recipient, null, BusinessNotificationKind.SCHEDULE,
                null, "Push is also safe for Inbox", null, null);

        assertThat(command.inboxText()).isEqualTo("Push is also safe for Inbox");
        assertThat(command.pushText()).isEqualTo("Push is also safe for Inbox");
    }

    @Test
    void usesRequiredTransactionSoCallerRollbackAlsoRollsBackNotification() throws Exception {
        Method method = InboxMessageService.class.getMethod(
                "createBusinessNotification", BusinessNotificationCommand.class);
        Transactional transactional = method.getAnnotation(Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.REQUIRED);
        assertThat(transactional.noRollbackFor()).isEmpty();
        assertThat(transactional.noRollbackForClassName()).isEmpty();
    }

    @Test
    void legacyCreateEventStillStoresContentWithoutPushText() {
        when(messages.findByRestaurantIdAndTypeAndMeta(7L, InboxMessageType.EVENT, "legacy:test"))
                .thenReturn(Optional.empty());
        when(messages.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        InboxMessage message = service.createEvent(
                restaurant, null, "Legacy content", null, "legacy:test", java.util.List.of(recipient), null);

        assertThat(message.getContent()).isEqualTo("Legacy content");
        assertThat(message.getPushText()).isNull();
        verify(pushEnqueueService).enqueueForMessage(message, java.util.List.of(recipient));
    }

    @Test
    void operationIdsAreGeneratedServerSideAndAreDistinct() {
        assertThat(BusinessNotificationOperationId.generate())
                .isNotEqualTo(BusinessNotificationOperationId.generate());
    }

    @Test
    void acquiresTransactionLockBeforeCheckingOrCreatingIdentity() {
        String identity = BusinessNotificationIdentity.meta(
                7L, OPERATION_ID, 11L, BusinessNotificationKind.SCHEDULE);
        when(messages.findByRestaurantIdAndTypeAndMeta(7L, InboxMessageType.EVENT, identity))
                .thenReturn(Optional.empty());
        when(messages.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        service.createBusinessNotification(command(
                OPERATION_ID, recipient, User.builder().id(999L).build(), BusinessNotificationKind.SCHEDULE));

        InOrder order = inOrder(messages);
        order.verify(messages).lockBusinessNotificationIdentity(identity);
        order.verify(messages).findByRestaurantIdAndTypeAndMeta(7L, InboxMessageType.EVENT, identity);
        order.verify(messages).save(any(InboxMessage.class));
    }

    private BusinessNotificationCommand command(UUID operationId, RestaurantMember target, User actor,
                                                BusinessNotificationKind kind) {
        return new BusinessNotificationCommand(
                restaurant, operationId, target, actor, kind, "Detailed", null, null, null);
    }

    private RestaurantMember member(Long memberId, Long userId) {
        return RestaurantMember.builder()
                .id(memberId)
                .restaurant(restaurant)
                .user(User.builder().id(userId).build())
                .build();
    }
}
