package ru.staffly.member.lifecycle;

import ru.staffly.common.exception.ConflictException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.Candidate;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.RestaurantRole;
import java.util.*;

/** Shared ordering and conflicts; module eligibility stays in the module. */
public final class PositionChangeSupport {
    private PositionChangeSupport() {}
    public static ConflictException stale() {
        return new ConflictException("POSITION_CHANGE_PLAN_STALE: refresh the impact plan",
                Map.of("code", "POSITION_CHANGE_PLAN_STALE"));
    }
    public static boolean management(Position position) {
        return position.getLevel() == RestaurantRole.ADMIN || position.getLevel() == RestaurantRole.MANAGER;
    }
    public static Comparator<RestaurantMember> candidateOrder(Position target) {
        return Comparator.comparingInt((RestaurantMember m) -> {
            if (m.getPosition() != null && Objects.equals(m.getPosition().getId(), target.getId())) return 0;
            if (m.effectiveRole() == target.getLevel()) return 1;
            return rank(m.effectiveRole()) < rank(target.getLevel()) ? 2 : 3;
        }).thenComparing(RestaurantMember::getId);
    }
    private static int rank(RestaurantRole role) {
        return role == RestaurantRole.ADMIN ? 0 : role == RestaurantRole.MANAGER ? 1 : 2;
    }
    public static Candidate candidate(RestaurantMember m) {
        return new Candidate(m.getId(), m.getUser().getId(), m.getUser().getFullName(),
                m.getPosition() == null ? null : m.getPosition().getName());
    }
}
