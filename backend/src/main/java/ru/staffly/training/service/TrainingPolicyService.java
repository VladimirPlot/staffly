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

    public Set<Long> allowedKnowledgePositionIds(Long userId, Long restaurantId) {
        return allowedPositionIdsByContext(userId, restaurantId, PolicyContext.KNOWLEDGE);
    }

    public Set<Long> allowedQuestionBankPositionIds(Long userId, Long restaurantId) {
        return allowedPositionIdsByContext(userId, restaurantId, PolicyContext.QUESTION_BANK);
    }

    public Set<Long> allowedExamTargetPositionIds(Long userId, Long restaurantId) {
        return allowedPositionIdsByContext(userId, restaurantId, PolicyContext.EXAM_TARGET);
    }

    public boolean canAccessKnowledgeByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.KNOWLEDGE);
    }

    public boolean canAccessQuestionBankByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.QUESTION_BANK);
    }

    public boolean canAccessExamTargetByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.EXAM_TARGET);
    }

    public void assertCanAccessKnowledgeByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.KNOWLEDGE,
                "Training knowledge policy does not allow access to this visibility scope.");
    }

    public void assertCanAccessQuestionBankByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.QUESTION_BANK,
                "Training question-bank policy does not allow access to this visibility scope.");
    }

    public void assertCanAccessExamTargetByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.EXAM_TARGET,
                "Training exam-target policy does not allow access to this visibility scope.");
    }

    public void assertCanUseKnowledgePositions(Long userId, Long restaurantId, Set<Long> positionIds) {
        assertCanUsePositions(userId, restaurantId, positionIds, PolicyContext.KNOWLEDGE);
    }

    public void assertCanUseQuestionBankPositions(Long userId, Long restaurantId, Set<Long> positionIds) {
        assertCanUsePositions(userId, restaurantId, positionIds, PolicyContext.QUESTION_BANK);
    }

    public void assertCanUseExamTargetPositions(Long userId, Long restaurantId, Set<Long> positionIds) {
        assertCanUsePositions(userId, restaurantId, positionIds, PolicyContext.EXAM_TARGET);
    }

    private Set<Long> allowedPositionIdsByContext(Long userId, Long restaurantId, PolicyContext policyContext) {
        var allowedLevels = allowedLevelsByContext(resolveContext(userId, restaurantId), policyContext);
        return positions.findByRestaurantId(restaurantId).stream()
                .filter(position -> allowedLevels.contains(position.getLevel()))
                .map(position -> position.getId())
                .collect(Collectors.toSet());
    }

    private boolean canAccessByVisibility(Long userId,
                                          Long restaurantId,
                                          Set<Long> visibilityPositionIds,
                                          PolicyContext policyContext) {
        if (visibilityPositionIds == null || visibilityPositionIds.isEmpty()) {
            return true;
        }
        var allowed = allowedPositionIdsByContext(userId, restaurantId, policyContext);
        return visibilityPositionIds.stream().anyMatch(allowed::contains);
    }

    private void assertCanAccessByVisibility(Long userId,
                                             Long restaurantId,
                                             Set<Long> visibilityPositionIds,
                                             PolicyContext policyContext,
                                             String message) {
        if (!canAccessByVisibility(userId, restaurantId, visibilityPositionIds, policyContext)) {
            throw new ForbiddenException(message);
        }
    }

    private void assertCanUsePositions(Long userId, Long restaurantId, Set<Long> positionIds, PolicyContext policyContext) {
        var allowed = allowedPositionIdsByContext(userId, restaurantId, policyContext);
        if (!allowed.containsAll(positionIds)) {
            throw new ForbiddenException("Training policy does not allow selected positions.");
        }
    }

    private Set<RestaurantRole> allowedLevelsByContext(TrainingPolicyContext context, PolicyContext policyContext) {
        if (context.isCreator() || context.hasExaminerAuthority()) {
            return EnumSet.of(RestaurantRole.STAFF, RestaurantRole.MANAGER, RestaurantRole.ADMIN);
        }
        return switch (policyContext) {
            case KNOWLEDGE -> switch (context.baseRole()) {
                case ADMIN -> EnumSet.of(RestaurantRole.STAFF, RestaurantRole.MANAGER, RestaurantRole.ADMIN);
                case MANAGER -> EnumSet.of(RestaurantRole.STAFF, RestaurantRole.MANAGER);
                case STAFF -> EnumSet.of(RestaurantRole.STAFF);
            };
            case QUESTION_BANK, EXAM_TARGET -> switch (context.baseRole()) {
                case ADMIN -> EnumSet.of(RestaurantRole.STAFF, RestaurantRole.MANAGER);
                case MANAGER, STAFF -> EnumSet.of(RestaurantRole.STAFF);
            };
        };
    }

    private TrainingPolicyContext resolveContext(Long userId, Long restaurantId) {
        if (isCreator()) {
            return new TrainingPolicyContext(true, true, true, RestaurantRole.ADMIN);
        }
        RestaurantMember member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Not a member"));

        boolean hasExaminerAuthority = member.getPosition() != null
                && PositionSpecializations.hasExaminer(member.getPosition().getSpecializations());
        boolean hasBaseRoleAuthority = member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;

        return new TrainingPolicyContext(hasBaseRoleAuthority || hasExaminerAuthority, false, hasExaminerAuthority, member.getRole());
    }

    private boolean isCreator() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(grantedAuthority -> "ROLE_CREATOR".equals(grantedAuthority.getAuthority()));
    }

    private enum PolicyContext {
        KNOWLEDGE("knowledge"),
        QUESTION_BANK("question-bank"),
        EXAM_TARGET("exam-target");

        private final String code;

        PolicyContext(String code) {
            this.code = code;
        }
    }

    private record TrainingPolicyContext(
            boolean canManageTraining,
            boolean isCreator,
            boolean hasExaminerAuthority,
            RestaurantRole baseRole
    ) {}
}