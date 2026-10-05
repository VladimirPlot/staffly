package ru.staffly.member.lifecycle;
import ru.staffly.invite.model.Invitation;
import ru.staffly.dictionary.model.Position;
import ru.staffly.user.model.User;
import java.time.Instant;
import java.util.UUID;
public record AdmissionApplyContext(Invitation invitation, User user, Position position,
                                    Instant operationNow, UUID operationId) {
    public Long restaurantId() { return invitation.getRestaurant().getId(); }
}
