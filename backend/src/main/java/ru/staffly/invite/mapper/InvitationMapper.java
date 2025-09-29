package ru.staffly.invite.mapper;

import org.springframework.stereotype.Component;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.invite.model.Invitation;

@Component
public class InvitationMapper {

    public InviteResponse toResponse(Invitation inv) {
        if (inv == null) return null;
        return new InviteResponse(
                inv.getId(),
                inv.getRestaurant() != null ? inv.getRestaurant().getId() : null,
                inv.getPhoneOrEmail(),
                inv.getToken(),
                inv.getStatus(),
                inv.getExpiresAt(),
                inv.getInvitedBy() != null ? inv.getInvitedBy().getId() : null,
                inv.getCreatedAt(),
                inv.getDesiredRole(),
                inv.getPosition() != null ? inv.getPosition().getId() : null
        );
    }
}