package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.dictionary.model.PositionSpecializations;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;

import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TrainingPolicyService {
    private final RestaurantMemberRepository members;
    private final PositionRepository positions;

    public boolean canManageTraining(Long userId, Long restaurantId) {
        return resolveContext(userId, restaurantId).canManageTraining();
    }

    public Set<RestaurantRole> allowedTrainingTargetLevels(Long userId, Long restaurantId) {
        return resolveContext(userId, restaurantId).allowedLevels();
    }

    public Set<Long> allowedPositionIds(Long userId, Long restaurantId) {
        var context = resolveContext(userId, restaurantId);
        return positions.findByRestaurantId(restaurantId).stream()
                .filter(position -> context.allowedLevels().contains(position.getLevel()))
                .map(position -> position.getId())
                .collect(Collectors.toSet());
    }

    public boolean canAccessQuestionBankByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessTrainingVisibility(userId, restaurantId, visibilityPositionIds);
    }

    public boolean canAccessTrainingVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        if (visibilityPositionIds == null || visibilityPositionIds.isEmpty()) {
            return true;
        }
        var allowed = allowedPositionIds(userId, restaurantId);
        return visibilityPositionIds.stream().anyMatch(allowed::contains);
    }

    public void assertCanAccessQuestionBankByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessTrainingVisibility(userId, restaurantId, visibilityPositionIds,
                "Training policy does not allow access to this question bank scope.");
    }

    public void assertCanAccessTrainingVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessTrainingVisibility(userId, restaurantId, visibilityPositionIds,
                "Training policy does not allow access to this training visibility scope.");
    }

    public void assertCanAccessTrainingVisibility(Long userId,
                                                  Long restaurantId,
                                                  Set<Long> visibilityPositionIds,
                                                  String message) {
        if (!canAccessTrainingVisibility(userId, restaurantId, visibilityPositionIds)) {
            throw new ForbiddenException(message);
        }
    }

    public void assertCanUsePositions(Long userId, Long restaurantId, Set<Long> positionIds) {
        var allowed = allowedPositionIds(userId, restaurantId);
        if (!allowed.containsAll(positionIds)) {
            throw new ForbiddenException("Training policy does not allow selected positions.");
        }
    }

    private TrainingPolicyContext resolveContext(Long userId, Long restaurantId) {
        if (isCreator()) {
            return new TrainingPolicyContext(true, true, EnumSet.of(RestaurantRole.STAFF, RestaurantRole.MANAGER, RestaurantRole.ADMIN));
        }
        RestaurantMember member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Not a member"));

        boolean hasExaminerAuthority = member.getPosition() != null
                && PositionSpecializations.hasExaminer(member.getPosition().getSpecializations());
        boolean hasBaseRoleAuthority = member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;

        Set<RestaurantRole> levels = hasExaminerAuthority
                ? EnumSet.of(RestaurantRole.STAFF, RestaurantRole.MANAGER, RestaurantRole.ADMIN)
                : switch (member.getRole()) {
            case ADMIN -> EnumSet.of(RestaurantRole.STAFF, RestaurantRole.MANAGER);
            case MANAGER -> EnumSet.of(RestaurantRole.STAFF);
            case STAFF -> EnumSet.of(RestaurantRole.STAFF);
        };
        return new TrainingPolicyContext(hasExaminerAuthority || hasBaseRoleAuthority, hasExaminerAuthority, levels);
    }

    private boolean isCreator() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(grantedAuthority -> "ROLE_CREATOR".equals(grantedAuthority.getAuthority()));
    }

    private record TrainingPolicyContext(
            boolean canManageTraining,
            boolean hasExaminerAuthority,
            Set<RestaurantRole> allowedLevels
    ) {}
}