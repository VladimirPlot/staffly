package ru.staffly.member.service.policy;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.security.SecurityService;

@Service
@RequiredArgsConstructor
public class MemberRemovalPolicyService {

    private final RestaurantMemberRepository members;
    private final SecurityService security;

    public void assertCanStartRemoval(Long restaurantId, Long actorUserId, RestaurantMember targetMember) {
        security.assertMember(actorUserId, restaurantId);
        if (!targetMember.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Member belongs to another restaurant");
        }

        var actor = members.findByUserIdAndRestaurantId(actorUserId, restaurantId);
        if (actor.isEmpty()) {
            if (security.isAdmin(actorUserId, restaurantId)) {
                return;
            }
            throw new ForbiddenException("Not a member");
        }

        boolean selfRemoval = actor.get().getId().equals(targetMember.getId());
        if (selfRemoval) {
            return;
        }

        switch (actor.get().getRole()) {
            case ADMIN -> {
            }
            case MANAGER -> {
                if (targetMember.getRole() != RestaurantRole.STAFF) {
                    throw new ForbiddenException("Managers can remove only STAFF members");
                }
            }
            case STAFF -> throw new ForbiddenException("Staff can remove only themselves");
        }
    }

    public void assertCanCompleteRemoval(Long restaurantId, Long actorUserId, RestaurantMember targetMember) {
        assertCanStartRemoval(restaurantId, actorUserId, targetMember);
        if (targetMember.getRole() == RestaurantRole.ADMIN) {
            long admins = members.countByRestaurantIdAndRole(restaurantId, RestaurantRole.ADMIN);
            if (admins <= 1) {
                throw new ConflictException("Cannot remove the last ADMIN");
            }
        }
    }
}
