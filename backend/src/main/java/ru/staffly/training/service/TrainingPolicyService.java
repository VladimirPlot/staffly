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

    /** Resolves the actor and restaurant positions once for certification tree authority calculations. */
    public CertificationManagementScopes certificationManagementScopes(Long userId, Long restaurantId) {
        var context = resolveContext(userId, restaurantId);
        var folderLevels = allowedLevelsByContext(context, PolicyContext.CERTIFICATION);
        var targetLevels = allowedLevelsByContext(context, PolicyContext.EXAM_TARGET);
        var restaurantPositions = positions.findByRestaurantId(restaurantId);
        var folderPositionIds = restaurantPositions.stream()
                .filter(position -> folderLevels.contains(position.getLevel()))
                .map(position -> position.getId())
                .collect(Collectors.toUnmodifiableSet());
        var targetPositionIds = restaurantPositions.stream()
                .filter(position -> targetLevels.contains(position.getLevel()))
                .map(position -> position.getId())
                .collect(Collectors.toUnmodifiableSet());
        return new CertificationManagementScopes(folderPositionIds, targetPositionIds);
    }

    public record CertificationManagementScopes(Set<Long> folderPositionIds, Set<Long> targetPositionIds) {
    }

    public boolean canAccessKnowledgeByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.KNOWLEDGE);
    }

    public boolean canAccessQuestionBankByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.QUESTION_BANK);
    }

    public boolean canAccessCertificationByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.CERTIFICATION);
    }

    public boolean canAccessExamTargetByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        return canAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.EXAM_TARGET);
    }

    public boolean canManageCertificationTargets(Long userId, Long restaurantId, Set<Long> targetPositionIds) {
        if (targetPositionIds == null || targetPositionIds.isEmpty()) {
            return false;
        }
        var allowed = allowedPositionIdsByContext(userId, restaurantId, PolicyContext.EXAM_TARGET);
        return allowed.containsAll(targetPositionIds);
    }

    /** Folder navigation is intersection-based, but changing a folder requires its entire scope. */
    public boolean canManageCertificationFolderOwnScope(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        if (visibilityPositionIds == null || visibilityPositionIds.isEmpty()) {
            return true;
        }
        return allowedPositionIdsByContext(userId, restaurantId, PolicyContext.CERTIFICATION)
                .containsAll(visibilityPositionIds);
    }

    public boolean canAccessCertificationEmployeeAnalyticsTargetRole(Long userId, Long restaurantId, RestaurantRole targetRole) {
        var context = resolveContext(userId, restaurantId);
        if (context.isCreator()) {
            return true;
        }
        if (context.hasExaminerAuthority()) {
            return targetRole == RestaurantRole.STAFF
                    || targetRole == RestaurantRole.MANAGER
                    || targetRole == RestaurantRole.ADMIN;
        }
        return switch (context.baseRole()) {
            case MANAGER -> targetRole == RestaurantRole.STAFF;
            case ADMIN -> targetRole == RestaurantRole.STAFF || targetRole == RestaurantRole.MANAGER;
            case STAFF -> false;
        };
    }

    public void assertCanAccessKnowledgeByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.KNOWLEDGE,
                "Training knowledge policy does not allow access to this visibility scope.");
    }

    public void assertCanAccessQuestionBankByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.QUESTION_BANK,
                "Training question-bank policy does not allow access to this visibility scope.");
    }

    public void assertCanAccessCertificationByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.CERTIFICATION,
                "Training certification policy does not allow access to this visibility scope.");
    }

    public void assertCanAccessExamTargetByVisibility(Long userId, Long restaurantId, Set<Long> visibilityPositionIds) {
        assertCanAccessByVisibility(userId, restaurantId, visibilityPositionIds, PolicyContext.EXAM_TARGET,
                "Training exam-target policy does not allow access to this visibility scope.");
    }

    public void assertCanManageCertificationTargets(Long userId, Long restaurantId, Set<Long> targetPositionIds) {
        if (!canManageCertificationTargets(userId, restaurantId, targetPositionIds)) {
            throw new ForbiddenException("Training exam-target policy does not allow access to this visibility scope.");
        }
    }

    public void assertCanUseKnowledgePositions(Long userId, Long restaurantId, Set<Long> positionIds) {
        assertCanUsePositions(userId, restaurantId, positionIds, PolicyContext.KNOWLEDGE);
    }

    public void assertCanUseQuestionBankPositions(Long userId, Long restaurantId, Set<Long> positionIds) {
        assertCanUsePositions(userId, restaurantId, positionIds, PolicyContext.QUESTION_BANK);
    }

    public void assertCanUseCertificationPositions(Long userId, Long restaurantId, Set<Long> positionIds) {
        assertCanUsePositions(userId, restaurantId, positionIds, PolicyContext.CERTIFICATION);
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
            case QUESTION_BANK, CERTIFICATION, EXAM_TARGET -> switch (context.baseRole()) {
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
        CERTIFICATION("certification"),
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
