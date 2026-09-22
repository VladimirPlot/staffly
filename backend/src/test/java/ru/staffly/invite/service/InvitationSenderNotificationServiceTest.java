package ru.staffly.invite.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.dictionary.model.Position;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationAfterCommitService;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.invite.model.Invitation;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvitationSenderNotificationServiceTest {
    private static final UUID OPERATION_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

    @Mock RestaurantMemberRepository members;
    @Mock UserRepository users;
    @Mock BusinessNotificationAfterCommitService afterCommit;

    private InvitationSenderNotificationService service;
    private Invitation invitation;
    private User sender;
    private RestaurantMember recipient;

    @BeforeEach
    void setUp() {
        service = new InvitationSenderNotificationService(members, users, afterCommit);
        Restaurant restaurant = Restaurant.builder().id(3L).build();
        sender = User.builder().id(7L).fullName("Иван Иванов").build();
        recipient = RestaurantMember.builder().id(70L).restaurant(restaurant).user(sender)
                .role(RestaurantRole.STAFF).build();
        invitation = Invitation.builder().id(11L).restaurant(restaurant).invitedBy(sender)
                .phoneOrEmail("employee@example.com").build();
    }

    @Test
    void acceptedUsesCurrentSenderMembershipRegardlessOfCurrentRoleAndIncludesMemberMetadata() {
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(recipient));
        User employee = User.builder().id(9L).fullName("Владимир Смирнов").build();
        RestaurantMember accepted = RestaurantMember.builder().id(90L).restaurant(invitation.getRestaurant())
                .user(employee).position(Position.builder().name("Официант").build()).build();

        service.submitAccepted(invitation, accepted, employee, OPERATION_ID);

        BusinessNotificationCommand command = command();
        assertThat(command.kind()).isEqualTo(BusinessNotificationKind.INVITATION);
        assertThat(command.operationId()).isEqualTo(OPERATION_ID);
        assertThat(command.recipient()).isSameAs(recipient);
        assertThat(command.actor()).isSameAs(employee);
        assertThat(command.inboxText()).contains("Владимир Смирнов", "Официант");
        assertThat(command.inboxText()).isEqualTo(
                "Приглашение принято: Владимир Смирнов. Должность: «Официант».");
        assertThat(command.pushText()).isEqualTo("Приглашение принято: Владимир Смирнов.");
        assertThat(command.metadata()).containsOnlyKeys("invitationId", "outcome", "memberId")
                .containsEntry("invitationId", 11L).containsEntry("outcome", "ACCEPTED")
                .containsEntry("memberId", 90L);
    }

    @Test
    void missingCurrentSenderMembershipSkipsWithoutFallback() {
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.empty());

        service.submitDeclined(invitation, User.builder().id(9L).fullName("Владимир").build(), OPERATION_ID);

        verifyNoInteractions(afterCommit);
    }

    @Test
    void declinedUsesOnlyInvitationIdentityOutcomeAndEmployeeActor() {
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(recipient));
        User employee = User.builder().id(9L).fullName("Владимир").build();

        service.submitDeclined(invitation, employee, OPERATION_ID);

        BusinessNotificationCommand command = command();
        assertThat(command.actor()).isSameAs(employee);
        assertThat(command.inboxText()).isEqualTo("Приглашение отклонено: Владимир.");
        assertThat(command.pushText()).isEqualTo("Приглашение отклонено: Владимир.");
        assertThat(command.metadata()).containsOnlyKeys("invitationId", "outcome")
                .containsEntry("outcome", "DECLINED");
    }

    @Test
    void invalidatedRetainsExistingSafeReasonAndNeverAddsResourceMetadata() {
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(recipient));
        User employee = User.builder().id(9L).fullName("Владимир").build();

        service.submitInvalidated(invitation, employee, "SCHEDULE_CHANGED", OPERATION_ID);

        assertThat(command().metadata()).containsOnlyKeys("invitationId", "outcome", "reason")
                .containsEntry("outcome", "INVALIDATED")
                .containsEntry("reason", "SCHEDULE_CHANGED");
    }

    @Test
    void expiredUsesSystemActorAndAuthoritativeTargetUserWhenAvailable() {
        when(users.findByPhoneOrEmail("employee@example.com"))
                .thenReturn(Optional.of(User.builder().id(9L).fullName("Владимир").build()));
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(recipient));

        service.submitExpired(invitation, OPERATION_ID);

        BusinessNotificationCommand command = command();
        assertThat(command.actor()).isNull();
        assertThat(command.inboxText()).isEqualTo(
                "Истёк срок приглашения: Владимир. При необходимости отправьте новое приглашение.");
        assertThat(command.pushText()).isEqualTo("Истёк срок приглашения: Владимир.");
        assertThat(command.metadata()).containsOnlyKeys("invitationId", "outcome")
                .containsEntry("outcome", "EXPIRED");
    }

    @Test
    void cancellationByOriginalSenderStillReachesCentralFoundationForSuppression() {
        when(users.findByPhoneOrEmail("employee@example.com")).thenReturn(Optional.empty());
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(recipient));

        service.submitCanceled(invitation, sender, OPERATION_ID);

        BusinessNotificationCommand command = command();
        assertThat(command.actor()).isSameAs(sender);
        assertThat(command.recipient()).isSameAs(recipient);
        assertThat(command.metadata()).containsOnlyKeys("invitationId", "outcome")
                .containsEntry("outcome", "CANCELED");
    }

    @Test
    void cancellationByAnotherManagerTargetsOriginalSenderAndRetainsCancelingActor() {
        User manager = User.builder().id(8L).fullName("Пётр Петров").build();
        when(users.findByPhoneOrEmail("employee@example.com")).thenReturn(Optional.empty());
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(recipient));

        service.submitCanceled(invitation, manager, OPERATION_ID);

        BusinessNotificationCommand command = command();
        assertThat(command.recipient()).isSameAs(recipient);
        assertThat(command.actor()).isSameAs(manager);
        assertThat(command.inboxText()).contains("Инициатор отмены: Пётр Петров.");
        assertThat(command.pushText()).doesNotContain("Пётр Петров");
    }

    @Test
    void registrationFailureIsSecondary() {
        when(members.findWithUserByUserIdAndRestaurantId(7L, 3L)).thenReturn(Optional.of(recipient));
        doThrow(new IllegalStateException("notification unavailable")).when(afterCommit).submit(anyList());

        service.submitDeclined(invitation, User.builder().id(9L).fullName("Владимир").build(), OPERATION_ID);
    }

    @SuppressWarnings("unchecked")
    private BusinessNotificationCommand command() {
        ArgumentCaptor<List<BusinessNotificationCommand>> captor = ArgumentCaptor.forClass(List.class);
        verify(afterCommit).submit(captor.capture());
        return captor.getValue().get(0);
    }
}
