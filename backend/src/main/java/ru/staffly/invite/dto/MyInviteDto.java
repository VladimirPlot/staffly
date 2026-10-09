package ru.staffly.invite.dto;

import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.invite.model.Invitation;

import java.time.Instant;

public record MyInviteDto(
        String token,
        Long restaurantId,
        String restaurantName,
        RestaurantRole desiredRole,
        Long positionId,
        String positionName,
        Instant expiresAt
) {
    /** Position identity/name come only from the issued plan. desiredRole is the persisted display
     * snapshot captured at creation; admission authority remains Position.level revalidation. */
    public static MyInviteDto from(Invitation invitation) {
        var snapshot = invitation.getPositionSnapshot();
        // V119 prohibits pending legacy plans. Fail visibly if that invariant is broken,
        // including malformed JSON, rather than presenting mutable Position as historical terms.
        if (snapshot == null || snapshot.positionId() == null || snapshot.definition() == null
                || snapshot.definition().name() == null) {
            throw new IllegalStateException("Invitation has no valid Position snapshot: " + invitation.getId());
        }
        var restaurant = invitation.getRestaurant();
        return new MyInviteDto(invitation.getToken(), restaurant.getId(), restaurant.getName(),
                invitation.getDesiredRole(), snapshot.positionId(), snapshot.definition().name(),
                invitation.getExpiresAt());
    }
}
