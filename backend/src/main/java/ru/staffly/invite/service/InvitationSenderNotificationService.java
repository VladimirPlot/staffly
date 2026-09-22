package ru.staffly.invite.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationAfterCommitService;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Builds best-effort outcome notifications for an invitation's original sender. */
@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationSenderNotificationService {
    private final RestaurantMemberRepository members;
    private final UserRepository users;
    private final BusinessNotificationAfterCommitService afterCommit;

    public void submitAccepted(Invitation invitation, RestaurantMember acceptedMember, User actor, UUID operationId) {
        String employee = display(acceptedMember.getUser(), invitation.getPhoneOrEmail());
        String position = acceptedMember.getPosition() == null ? null : acceptedMember.getPosition().getName();
        String inbox = "Приглашение принято: " + employee + "."
                + (position == null || position.isBlank() ? "" : " Должность: «" + position + "».");
        submit(invitation, actor, operationId, InvitationStatus.ACCEPTED, acceptedMember.getId(), null,
                inbox, "Приглашение принято: " + employee + ".");
    }

    public void submitDeclined(Invitation invitation, User actor, UUID operationId) {
        String employee = display(actor, invitation.getPhoneOrEmail());
        submit(invitation, actor, operationId, InvitationStatus.DECLINED, null, null,
                "Приглашение отклонено: " + employee + ".",
                "Приглашение отклонено: " + employee + ".");
    }

    public void submitInvalidated(Invitation invitation, User actor, String reason, UUID operationId) {
        String employee = display(actor, invitation.getPhoneOrEmail());
        submit(invitation, actor, operationId, InvitationStatus.INVALIDATED, null, reason,
                "Приглашение больше недействительно: " + employee
                        + ". Условия изменились — отправьте новое приглашение.",
                "Приглашение больше недействительно: " + employee + ".");
    }

    public void submitExpired(Invitation invitation, UUID operationId) {
        User target = findTarget(invitation);
        String employee = display(target, invitation.getPhoneOrEmail());
        submit(invitation, null, operationId, InvitationStatus.EXPIRED, null, null,
                "Истёк срок приглашения: " + employee + ". При необходимости отправьте новое приглашение.",
                "Истёк срок приглашения: " + employee + ".");
    }

    public void submitCanceled(Invitation invitation, User actor, UUID operationId) {
        User target = findTarget(invitation);
        String employee = display(target, invitation.getPhoneOrEmail());
        String actorName = display(actor, "Пользователь");
        submit(invitation, actor, operationId, InvitationStatus.CANCELED, null, null,
                "Приглашение отменено: " + employee + ". Инициатор отмены: " + actorName + ".",
                "Приглашение отменено: " + employee + ".");
    }

    private void submit(Invitation invitation, User actor, UUID operationId, InvitationStatus outcome,
                        Long memberId, String reason, String inbox, String push) {
        User sender = invitation.getInvitedBy();
        if (sender == null) return;
        RestaurantMember recipient = resolveRecipient(invitation, sender);
        if (recipient == null) return;

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("invitationId", invitation.getId());
        metadata.put("outcome", outcome.name());
        if (memberId != null) metadata.put("memberId", memberId);
        if (reason != null) metadata.put("reason", reason);
        BusinessNotificationCommand command = new BusinessNotificationCommand(
                invitation.getRestaurant(), operationId, recipient, actor, BusinessNotificationKind.INVITATION,
                inbox, push, metadata, null);
        try {
            afterCommit.submit(List.of(command));
        } catch (RuntimeException ex) {
            log.warn("Failed to register invitation outcome notification (invitationId={}, outcome={})",
                    invitation.getId(), outcome, ex);
        }
    }

    private RestaurantMember resolveRecipient(Invitation invitation, User sender) {
        Long invitationId = Objects.requireNonNull(invitation.getId(), "invitation.id is required");
        var restaurant = Objects.requireNonNull(
                invitation.getRestaurant(), "invitation.restaurant is required");
        Long restaurantId = Objects.requireNonNull(
                restaurant.getId(), "invitation.restaurant.id is required");
        Long senderUserId = Objects.requireNonNull(sender.getId(), "sender.id is required");
        try {
            RestaurantMember recipient = members.findWithUserByUserIdAndRestaurantId(
                    senderUserId, restaurantId).orElse(null);
            if (recipient == null) {
                log.warn("Skipping invitation outcome notification: sender is not a current member "
                                + "(invitationId={}, restaurantId={}, senderUserId={})",
                        invitationId, restaurantId, senderUserId);
            }
            return recipient;
        } catch (RuntimeException ex) {
            log.warn("Failed to resolve invitation sender recipient (invitationId={}, senderUserId={})",
                    invitationId, senderUserId, ex);
            return null;
        }
    }

    private String display(User user, String fallback) {
        return user == null || user.getFullName() == null || user.getFullName().isBlank()
                ? fallback : user.getFullName().trim();
    }

    private User findTarget(Invitation invitation) {
        Long invitationId = Objects.requireNonNull(invitation.getId(), "invitation.id is required");
        String contact = Objects.requireNonNull(
                invitation.getPhoneOrEmail(), "invitation.phoneOrEmail is required");
        try {
            return users.findByPhoneOrEmail(contact).orElse(null);
        } catch (RuntimeException ex) {
            log.warn("Failed to resolve invitation target display name (invitationId={})",
                    invitationId, ex);
            return null;
        }
    }
}
